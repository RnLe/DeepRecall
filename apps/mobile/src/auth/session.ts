/**
 * Session management for mobile app
 */

import { secureStore } from "./secure-store";

export interface SessionInfo {
  userId: string;
  email: string | null;
  name?: string;
  deviceId: string;
  iat?: number;
  exp?: number;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/**
 * Parse JWT without verification (unsafe, but we trust our backend)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseJWTUnsafe(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("[Session] Failed to parse JWT:", error);
    return null;
  }
}

/**
 * Check if JWT is expired
 */
export function isJWTExpired(token: string): boolean {
  try {
    const payload = parseJWTUnsafe(token);
    if (!payload || !payload.exp) return true;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

/**
 * Load session from secure storage
 */
export async function loadSession(): Promise<SessionInfo | null> {
  try {
    const jwt = await secureStore.getAppJWT();
    if (!jwt) return null;

    // Check if expired
    if (isJWTExpired(jwt)) {
      await secureStore.removeAppJWT();
      return null;
    }

    const payload = parseJWTUnsafe(jwt);
    if (!payload) return null;

    return {
      userId: payload.userId || payload.user_id || payload.sub,
      email: payload.email || null,
      name: payload.name,
      deviceId: payload.deviceId || payload.device_id,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    console.error("[Session] Failed to load session:", error);
    return null;
  }
}

/**
 * Save session to secure storage
 */
export async function saveSession(jwt: string): Promise<void> {
  await secureStore.saveAppJWT(jwt);
}

/**
 * Clear session from secure storage
 */
export async function clearSession(): Promise<void> {
  try {
    // Use centralized sign-out flow
    const { handleSignOut, getDeviceId } = await import("@deeprecall/data");
    const { CapacitorBlobStorage } = await import("../blob-storage/capacitor");

    const deviceId = getDeviceId();
    const cas = new CapacitorBlobStorage();

    console.log("[Session] Running centralized sign-out flow...");
    await handleSignOut(deviceId, cas);
    console.log("[Session] Sign-out flow completed successfully");

    // Clear secure tokens
    await secureStore.removeAppJWT();
    await secureStore.removeGoogleRefreshToken();

    console.log("[Session] Session cleared successfully");
  } catch (error) {
    console.error("[Session] Failed to clear session:", error);
    // Even if centralized flow fails, clear tokens
    await secureStore.removeAppJWT();
    await secureStore.removeGoogleRefreshToken();
    throw error;
  }
}

/**
 * Get device ID (create if doesn't exist)
 */
export async function getOrCreateDeviceId(): Promise<string> {
  return secureStore.getOrCreateDeviceId();
}
