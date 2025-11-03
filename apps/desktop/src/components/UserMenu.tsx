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
import { UserMenu as SharedUserMenu } from "@deeprecall/ui";
import {
  signInWithGoogle,
  signInWithGitHub,
  initializeSession,
  clearSession,
  getOrCreateDeviceId,
  type SessionInfo,
} from "../auth";
import { SignInModal } from "./SignInModal";
import { GitHubDeviceCodeModal } from "./GitHubDeviceCodeModal";

export function UserMenu() {
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

    try {
      console.log(`[UserMenu] Starting ${provider} OAuth flow...`);

      // Get or create device ID
      const deviceId = await getOrCreateDeviceId();
      console.log("[UserMenu] Device ID:", deviceId);

      // Sign in with selected provider
      let result;
      if (provider === "google") {
        result = await signInWithGoogle(deviceId);
      } else {
        // GitHub uses device code flow - show modal
        result = await signInWithGitHub(deviceId, (data) => {
          console.log("[UserMenu] GitHub device code received:", data);
          setGitHubDeviceCode(data);
          setShowGitHubCodeModal(true);
          setShowSignInModal(false); // Close provider selection modal

          // Auto-open browser
          window.open(data.verification_uri, "_blank");
        });
      }

      console.log(`[UserMenu] ${provider} sign in successful:`, result.user);

      // Save app JWT to keychain (CRITICAL: needed for session persistence!)
      const { tokens } = await import("../auth/secure-store");
      await tokens.saveAppJWT(result.app_jwt);
      console.log("[UserMenu] Saved app JWT to keychain");

      // Parse JWT to get session info (avoid race condition with keychain)
      const { parseJWTUnsafe } = await import("../auth/session");
      const payload = parseJWTUnsafe(result.app_jwt);

      // Set session directly from result (faster than reloading from keychain)
      const session = {
        status: "authenticated" as const,
        userId: payload.userId,
        deviceId: payload.deviceId,
        provider: payload.provider as "google" | "github",
        appJWT: result.app_jwt,
        email: result.user.email,
        name: result.user.name,
      };

      setSessionInfo(session);
      setStatus("authenticated");
      setShowSignInModal(false); // Close modals on success
      setShowGitHubCodeModal(false);
    } catch (err) {
      console.error(`[UserMenu] ${provider} sign in failed:`, err);

      // User closed browser or cancelled - not an error, just reset to unauthenticated
      if (err instanceof Error) {
        // Check for common cancellation patterns
        const isCancellation =
          err.message.includes("User closed") ||
          err.message.includes("cancelled") ||
          err.message.includes("aborted") ||
          err.message.includes("timeout") ||
          err.message.includes("access_denied");

        if (isCancellation) {
          console.log("[UserMenu] User cancelled sign-in, no error shown");
          setShowSignInModal(false); // Close modals, return to unauthenticated state
          setShowGitHubCodeModal(false);
        } else {
          // Real error - show to user
          setError(err.message);
        }
      } else {
        setError("Sign in failed");
      }

      setStatus("unauthenticated");
      throw err; // Re-throw so modal knows sign-in failed
    }
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
            image: null, // Google doesn't provide picture in ID token by default
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
