"use client";

/**
 * Desktop User Menu - Native OAuth Implementation
 *
 * Uses native OAuth flows (PKCE for Google, Device Code for GitHub)
 * with OS keychain for secure token storage.
 *
 * Flow:
 * 1. User clicks "Sign In" button
 * 2. Modal shows provider selection (Google/GitHub)
 * 3. Opens system browser with OAuth challenge
 * 4. User grants permission (or closes browser)
 * 5. Desktop exchanges tokens with Auth Broker
 * 6. Stores app JWT in OS keychain
 * 7. Session automatically refreshed when expired
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserMenu as SharedUserMenu } from "@deeprecall/ui";
import {
  signInWithGoogle,
  signInWithGitHub,
  initializeSession,
  clearSession,
  getOrCreateDeviceId,
  type SessionInfo,
  emitAuthStateChanged,
} from "../auth";
import { SignInModal } from "./SignInModal";
import { GitHubDeviceCodeModal } from "./GitHubDeviceCodeModal";
import { profileStore } from "../auth/secure-store";

export function UserMenu() {
  const navigate = useNavigate();
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [status, setStatus] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showGitHubCodeModal, setShowGitHubCodeModal] = useState(false);
  const [gitHubDeviceCode, setGitHubDeviceCode] = useState<{
    user_code: string;
    verification_uri: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize session on mount
  useEffect(() => {
    async function loadSession() {
      try {
        console.log("[UserMenu] Initializing session...");
        const session = await initializeSession();

        setSessionInfo(session);
        setStatus(
          session.status === "authenticated"
            ? "authenticated"
            : "unauthenticated"
        );

        if (session.status === "expired") {
          console.log(
            "[UserMenu] Session expired, user needs to sign in again"
          );
        }
      } catch (err) {
        console.error("[UserMenu] Failed to initialize session:", err);
        setStatus("unauthenticated");
      }
    }

    loadSession();
  }, []);

  const handleSignIn = async (provider: "google" | "github") => {
    setError(null);

    // Close modal immediately - OAuth happens in background
    setShowSignInModal(false);

    // Show notification that browser is opening
    console.log(`[UserMenu] Opening browser for ${provider} sign-in...`);

    try {
      // Get or create device ID
      const deviceId = await getOrCreateDeviceId();
      console.log("[UserMenu] Device ID:", deviceId);

      // Start OAuth flow (non-blocking)
      if (provider === "google") {
        // Google PKCE flow - browser will open
        const result = await signInWithGoogle(deviceId);
        await handleSignInSuccess(result);
      } else {
        // GitHub Device Code flow - show modal with code
        await signInWithGitHub(deviceId, (data) => {
          console.log("[UserMenu] GitHub device code received:", data);
          setGitHubDeviceCode(data);
          setShowGitHubCodeModal(true);

          // Auto-open browser
          window.open(data.verification_uri, "_blank");
        }).then(handleSignInSuccess);
      }
    } catch (err) {
      console.error(`[UserMenu] ${provider} sign in failed:`, err);

      // Check if user cancelled
      if (err instanceof Error) {
        const isCancellation =
          err.message.includes("User closed") ||
          err.message.includes("cancelled") ||
          err.message.includes("aborted") ||
          err.message.includes("timeout") ||
          err.message.includes("access_denied");

        if (!isCancellation) {
          // Real error - show to user
          setError(`Sign-in failed: ${err.message}`);
        } else {
          console.log("[UserMenu] User cancelled sign-in");
        }
      }

      setStatus("unauthenticated");
    }
  };

  const handleSignInSuccess = async (result: {
    app_jwt: string;
    user: { id: string; provider: string; email: string; name: string };
  }) => {
    console.log("[UserMenu] Sign in successful:", result.user);

    // Save app JWT to keychain
    const { tokens } = await import("../auth/secure-store");
    await tokens.saveAppJWT(result.app_jwt);
    console.log("[UserMenu] Saved app JWT to keychain");

    // Verify keychain write immediately (helps diagnose keychain issues)
    const verifyJWT = await tokens.getAppJWT();
    console.log("[UserMenu] Verified stored app JWT", {
      retrieved: !!verifyJWT,
      matches: verifyJWT === result.app_jwt,
    });

    // Parse JWT to get session info
    const { parseJWTUnsafe } = await import("../auth/session");
    const payload = parseJWTUnsafe(result.app_jwt);

    // Set session
    const session = {
      status: "authenticated" as const,
      userId: payload.userId,
      deviceId: payload.deviceId,
      provider: payload.provider as "google" | "github",
      appJWT: result.app_jwt,
      email: result.user.email,
      name: result.user.name,
      avatarUrl: null,
    };

    await profileStore.save({
      userId: payload.userId,
      email: result.user.email,
      name: result.user.name,
      avatarUrl: null,
      updatedAt: new Date().toISOString(),
    });

    setSessionInfo(session);
    setStatus("authenticated");
    setShowGitHubCodeModal(false); // Close GitHub modal if open

    // Update global auth state directly (don't rely on event listener race condition)
    const { setAuthState } = await import("@deeprecall/data");
    const { getDeviceId } = await import("@deeprecall/data");
    const deviceId = getDeviceId();

    setAuthState(true, payload.userId, deviceId);
    console.log("[UserMenu] Updated global auth state", {
      userId: payload.userId,
      deviceId,
    });

    // Emit event for other listeners (after state is set)
    emitAuthStateChanged({ reason: "signin" });
  };

  const handleCancelGitHub = () => {
    console.log("[UserMenu] User cancelled GitHub sign-in");
    setShowGitHubCodeModal(false);
    setGitHubDeviceCode(null);
    setStatus("unauthenticated");
    // Note: The GitHub polling will timeout naturally
  };

  const handleSignOut = async () => {
    try {
      console.log("[UserMenu] Signing out...");
      await clearSession();
      setSessionInfo(null);
      setStatus("unauthenticated");
      setError(null);
      console.log("[UserMenu] Signed out successfully");
      emitAuthStateChanged({ reason: "signout" });
      navigate("/", { replace: true });
    } catch (err) {
      console.error("[UserMenu] Sign out failed:", err);
      setError(err instanceof Error ? err.message : "Sign out failed");
    }
  };

  // Convert SessionInfo to format expected by SharedUserMenu
  const session =
    sessionInfo?.status === "authenticated" && sessionInfo.userId
      ? {
          user: {
            id: sessionInfo.userId,
            name: sessionInfo.name || null,
            email: sessionInfo.email || null,
            image: sessionInfo.avatarUrl || null,
            provider: sessionInfo.provider,
          },
          expires: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6h from now
        }
      : null;

  return (
    <>
      <SharedUserMenu
        session={session}
        status={status}
        onSignIn={() => setShowSignInModal(true)}
        onSignOut={handleSignOut}
        onNavigateProfile={() => {
          // Desktop profile page - TODO
          console.log("[UserMenu] Navigate to profile");
        }}
      />

      {/* Sign-In Modal (Provider Selection) */}
      <SignInModal
        isOpen={showSignInModal}
        onClose={() => setShowSignInModal(false)}
        onSignIn={handleSignIn}
      />

      {/* GitHub Device Code Modal */}
      {gitHubDeviceCode && (
        <GitHubDeviceCodeModal
          isOpen={showGitHubCodeModal}
          userCode={gitHubDeviceCode.user_code}
          verificationUri={gitHubDeviceCode.verification_uri}
          onCancel={handleCancelGitHub}
        />
      )}

      {/* Error display */}
      {error && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            padding: "12px 20px",
            background: "#ef4444",
            color: "white",
            borderRadius: "8px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            zIndex: 9999,
          }}
        >
          <strong>Authentication Error:</strong> {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: "12px",
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "white",
              padding: "4px 8px",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
