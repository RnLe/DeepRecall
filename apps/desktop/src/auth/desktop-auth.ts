/**
 * Desktop Auth Module
 *
 * Handles OAuth authentication for desktop app via web-domain SSO.
 * Opens system browser for auth, captures callback via localhost server.
 */

import { invoke } from "@tauri-apps/api/core";

export interface AuthSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    provider?: string;
  };
  expires: string;
}

/**
 * Open web auth page in system browser
 * User completes OAuth on web, then redirects back to desktop
 */
export async function openAuthWindow(
  provider: "google" | "github"
): Promise<void> {
  await invoke("open_auth_window", { provider });
}

/**
 * Save auth session to local storage after callback
 */
export async function saveAuthSession(sessionToken: string): Promise<void> {
  await invoke("save_auth_session", { sessionToken });
}

/**
 * Clear auth session (sign out)
 */
export async function clearAuthSession(): Promise<void> {
  await invoke("clear_auth_session");
}

/**
 * Get current auth session from localStorage
 */
export function getAuthSession(): AuthSession | null {
  const sessionStr = localStorage.getItem("auth_session");
  if (!sessionStr) return null;

  try {
    return JSON.parse(sessionStr);
  } catch {
    return null;
  }
}

/**
 * Set auth session in localStorage
 */
export function setAuthSession(session: AuthSession): void {
  localStorage.setItem("auth_session", JSON.stringify(session));
}

/**
 * Remove auth session from localStorage
 */
export function removeAuthSession(): void {
  localStorage.removeItem("auth_session");
}

/**
 * Start local callback server to receive auth redirect
 * Listens on localhost:3001/auth/callback
 */
export async function startAuthCallbackServer(
  onCallback: (session: AuthSession) => void
): Promise<() => void> {
  // This would typically use a local HTTP server
  // For now, we'll use a simpler approach: polling or window.open

  // The web app will redirect to localhost:3001/auth/callback?token=xxx
  // We need to handle that URL

  // For MVP, we can use the system browser and manual token copy
  // Or implement a localhost server using Tauri HTTP plugin

  return () => {
    // Cleanup function
  };
}
