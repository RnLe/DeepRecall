/**
 * UserMenu component for mobile app
 * Provides authentication UI with Google and GitHub OAuth
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logger } from "@deeprecall/telemetry";
import { Portal } from "./Portal";
import {
  signInWithGoogle,
  signInWithGitHub,
  openGitHubVerification,
  closeBrowser,
  loadSession,
  saveSession,
  clearSession,
  getOrCreateDeviceId,
  parseJWTUnsafe,
  type SessionInfo,
  type AuthStatus,
} from "../auth";

interface GitHubDeviceCodeData {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export function UserMenu() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showGitHubCodeModal, setShowGitHubCodeModal] = useState(false);
  const [githubDeviceCode, setGitHubDeviceCode] =
    useState<GitHubDeviceCodeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load session on mount
  useEffect(() => {
    logger.info("ui", "UserMenu: Loading session on mount");
    loadSession()
      .then((session) => {
        if (session) {
          logger.info("ui", "UserMenu: Session loaded successfully", {
            email: session.email,
          });
          setSessionInfo(session);
          setStatus("authenticated");
        } else {
          logger.info("ui", "UserMenu: No existing session found");
          setStatus("unauthenticated");
        }
      })
      .catch((err) => {
        logger.error("ui", "UserMenu: Failed to load session", {
          error: String(err),
        });
        console.error("[UserMenu] Failed to load session:", err);
        setStatus("unauthenticated");
      });
  }, []);

  const handleSignIn = async (provider: "google" | "github") => {
    setError(null);

    // Close modal immediately - OAuth happens in background
    setShowSignInModal(false);

    logger.info("ui", "UserMenu: Starting sign-in", { provider });
    console.log(`[UserMenu] Starting ${provider} sign-in...`);

    try {
      const deviceId = await getOrCreateDeviceId();
      logger.info("ui", "UserMenu: Device ID obtained", { deviceId });
      console.log(`[UserMenu] Device ID: ${deviceId}`);

      if (provider === "google") {
        logger.info("ui", "UserMenu: Initiating Google OAuth");
        console.log(`[UserMenu] Initiating Google OAuth...`);
        const result = await signInWithGoogle(deviceId);
        logger.info("ui", "UserMenu: Google OAuth completed", {
          userEmail: result.user.email,
        });
        console.log(`[UserMenu] Google OAuth result received:`, result);
        await handleSignInSuccess(result);
      } else {
        logger.info("ui", "UserMenu: Initiating GitHub OAuth");
        console.log(`[UserMenu] Initiating GitHub Device Code flow...`);
        // GitHub Device Code flow - don't open browser yet, let user do it manually
        const result = await signInWithGitHub(deviceId, (data) => {
          logger.info("ui", "UserMenu: GitHub device code received", {
            userCode: data.user_code,
          });
          console.log(`[UserMenu] GitHub device code received:`, data);
          setGitHubDeviceCode(data);
          setShowGitHubCodeModal(true);
          // Don't open browser automatically - let user click the button
        });
        logger.info("ui", "UserMenu: GitHub OAuth completed", {
          userEmail: result.user.email,
        });
        console.log(`[UserMenu] GitHub OAuth result received:`, result);
        // Close modal and browser on success
        setShowGitHubCodeModal(false);
        try {
          await closeBrowser();
        } catch {
          // Ignore error if browser already closed
          console.log("[UserMenu] Browser already closed");
        }
        await handleSignInSuccess(result);
      }
    } catch (err: unknown) {
      const error = err as Error;
      // Detect if user cancelled
      const isCancellation =
        error?.message?.includes("cancelled") ||
        error?.message?.includes("timed out") ||
        error?.message?.includes("denied");

      if (!isCancellation) {
        logger.error("ui", "UserMenu: Sign-in failed", {
          error: error?.message,
          provider,
        });
        console.error("[UserMenu] Sign-in failed:", error);
        setError(`Sign-in failed: ${error?.message || "Unknown error"}`);
      } else {
        logger.info("ui", "UserMenu: Sign-in cancelled by user", { provider });
        console.log("[UserMenu] Sign-in cancelled by user");
      }

      setStatus("unauthenticated");
    }
  };

  const handleSignInSuccess = async (result: {
    app_jwt: string;
    user: { id: string; email: string | null; name: string };
  }) => {
    logger.info("ui", "UserMenu: Processing sign-in success", {
      userEmail: result.user.email || result.user.name,
    });
    console.log("[UserMenu] Sign-in successful, processing result...");

    try {
      // Save JWT token
      await saveSession(result.app_jwt);
      logger.info("ui", "UserMenu: JWT saved to secure storage");
      console.log("[UserMenu] JWT saved to secure storage");

      // Parse JWT to get user info
      const payload = parseJWTUnsafe(result.app_jwt);
      logger.info("ui", "UserMenu: JWT parsed", {
        userId: payload.userId || payload.user_id || payload.sub,
      });
      console.log("[UserMenu] JWT payload:", payload);

      // Update session state
      const newSessionInfo: SessionInfo = {
        userId: payload.userId || payload.user_id || payload.sub,
        email: result.user.email,
        name: result.user.name,
        deviceId: payload.deviceId || payload.device_id,
        iat: payload.iat,
        exp: payload.exp,
        appJWT: result.app_jwt,
      };

      logger.info("ui", "UserMenu: Setting session state", {
        email: newSessionInfo.email,
        name: newSessionInfo.name,
      });
      console.log("[UserMenu] Setting session info:", newSessionInfo);

      setSessionInfo(newSessionInfo);
      setStatus("authenticated");

      logger.info("ui", "UserMenu: Auth status set to authenticated");
      console.log("[UserMenu] Status set to authenticated");

      // Close GitHub code modal if open
      setShowGitHubCodeModal(false);

      logger.info("ui", "UserMenu: Sign-in complete");
    } catch (err) {
      logger.error("ui", "UserMenu: Error in handleSignInSuccess", {
        error: String(err),
      });
      console.error("[UserMenu] Error in handleSignInSuccess:", err);
      throw err;
    }
  };

  const handleSignOut = async () => {
    try {
      await clearSession();
      setSessionInfo(null);
      setStatus("unauthenticated");
      console.log("[UserMenu] Signed out");
      navigate("/", { replace: true });
    } catch (err) {
      console.error("[UserMenu] Sign-out failed:", err);
    }
  };

  const handleCopyGitHubCode = () => {
    if (githubDeviceCode) {
      navigator.clipboard.writeText(githubDeviceCode.user_code);
    }
  };

  const handleCancelGitHub = async () => {
    setShowGitHubCodeModal(false);
    setGitHubDeviceCode(null);
    await closeBrowser();
  };

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-500" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <>
        <button
          onClick={() => setShowSignInModal(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Sign In
        </button>

        {/* Sign In Modal */}
        {showSignInModal && (
          <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 pt-20 pb-8">
              <div className="w-full max-w-sm rounded-lg bg-gray-800 p-6 shadow-xl">
                <h2 className="mb-4 text-xl font-semibold text-white">
                  Sign In
                </h2>

                {error && (
                  <div className="mb-4 rounded-lg bg-red-900/50 p-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    onClick={() => handleSignIn("google")}
                    className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-100"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </button>

                  <button
                    onClick={() => handleSignIn("github")}
                    className="flex w-full items-center justify-center gap-3 rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-950"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Continue with GitHub
                  </button>
                </div>

                <button
                  onClick={() => setShowSignInModal(false)}
                  className="mt-4 w-full rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Portal>
        )}

        {/* GitHub Device Code Modal */}
        {showGitHubCodeModal && githubDeviceCode && (
          <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 pt-20 pb-8">
              <div className="w-full max-w-sm rounded-lg bg-gray-800 p-6 shadow-xl">
                <h2 className="mb-4 text-xl font-semibold text-white">
                  GitHub Authorization
                </h2>

                <p className="mb-4 text-sm text-gray-300">
                  Copy this code, then click "Open GitHub" to authorize:
                </p>

                <div className="mb-4 flex items-center justify-between rounded-lg bg-gray-900 p-4">
                  <span className="font-mono text-2xl font-bold text-white">
                    {githubDeviceCode.user_code}
                  </span>
                  <button
                    onClick={handleCopyGitHubCode}
                    className="rounded-lg bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                  >
                    Copy
                  </button>
                </div>

                <p className="mb-4 text-xs text-gray-400">
                  After authorizing on GitHub, you can close the browser. We'll
                  automatically complete the sign-in.
                </p>

                <div className="space-y-2">
                  <button
                    onClick={() =>
                      openGitHubVerification(githubDeviceCode.verification_uri)
                    }
                    className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Open GitHub
                  </button>

                  <button
                    onClick={handleCancelGitHub}
                    className="w-full rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </Portal>
        )}
      </>
    );
  }

  // Authenticated state
  return (
    <div className="flex items-center gap-3 px-4">
      <div className="flex flex-col items-end">
        {sessionInfo?.name && (
          <span className="text-sm font-medium text-white">
            {sessionInfo.name}
          </span>
        )}
        {sessionInfo?.email && (
          <span className="text-xs text-gray-400">{sessionInfo.email}</span>
        )}
        {!sessionInfo?.email && sessionInfo?.userId && (
          <span className="text-xs text-gray-400">
            ID: {sessionInfo.userId}
          </span>
        )}
      </div>
      <button
        onClick={handleSignOut}
        className="rounded-lg bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-600"
      >
        Sign Out
      </button>
    </div>
  );
}
