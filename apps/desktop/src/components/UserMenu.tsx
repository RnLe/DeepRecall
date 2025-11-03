"use client";

/**
 * Desktop User Menu - Native OAuth Implementation
 *
 * Uses native OAuth flows (PKCE for Google, Device Code for GitHub)
 * with OS keychain for secure token storage.
 *
 * Flow:
 * 1. User clicks "Sign in with Google"
 * 2. Opens system browser with PKCE challenge
 * 3. User grants permission on Google
 * 4. Browser redirects to loopback server
 * 5. Desktop exchanges tokens with Auth Broker
 * 6. Stores app JWT in OS keychain
 * 7. Session automatically refreshed when expired
 */

import { useState, useEffect } from "react";
import { UserMenu as SharedUserMenu } from "@deeprecall/ui";
import {
  signInWithGoogle,
  initializeSession,
  clearSession,
  getOrCreateDeviceId,
  type SessionInfo,
} from "../auth";

export function UserMenu() {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [status, setStatus] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");
  const [isSigningIn, setIsSigningIn] = useState(false);
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

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);

    try {
      console.log("[UserMenu] Starting Google OAuth flow...");

      // Get or create device ID
      const deviceId = await getOrCreateDeviceId();
      console.log("[UserMenu] Device ID:", deviceId);

      // Sign in with Google (opens browser, handles PKCE flow)
      const result = await signInWithGoogle(deviceId);
      console.log("[UserMenu] Sign in successful:", result.user);

      // Reload session
      const session = await initializeSession();
      setSessionInfo(session);
      setStatus("authenticated");
    } catch (err) {
      console.error("[UserMenu] Sign in failed:", err);
      setError(err instanceof Error ? err.message : "Sign in failed");
      setStatus("unauthenticated");
    } finally {
      setIsSigningIn(false);
    }
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
            name: null, // TODO: Store user name in session
            email: null, // TODO: Store email in session
            image: null,
            provider: sessionInfo.provider,
          },
          expires: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6h from now
        }
      : null;

  return (
    <>
      <SharedUserMenu
        session={session}
        status={isSigningIn ? "loading" : status}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onNavigateProfile={() => {
          // Desktop profile page - TODO
          console.log("[UserMenu] Navigate to profile");
        }}
      />

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
