/**
 * Desktop session management
 * Handles loading, refreshing, and clearing authentication sessions
 */

import {
  tokens as secureTokens,
  profileStore,
  type StoredUserProfile,
} from "./secure-store";
import { refreshGoogleSession } from "./google";

export interface SessionInfo {
  status: "authenticated" | "unauthenticated" | "expired";
  userId?: string;
  deviceId?: string;
  provider?: "google" | "github";
  appJWT?: string;
  email?: string;
  name?: string;
  avatarUrl?: string | null;
}

let cachedProfile: StoredUserProfile | null = null;
let inFlightProfile: Promise<StoredUserProfile | null> | null = null;

/**
 * Parse JWT payload without verification (client-side only)
 * Used to check expiry before making API calls
 */
export function parseJWTUnsafe(token: string): {
  userId: string;
  deviceId: string;
  provider: string;
  exp: number;
  iat: number;
} {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const payload = parts[1];
  const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(decoded);
}

/**
 * Check if a JWT is expired
 */
export function isJWTExpired(token: string): boolean {
  try {
    const payload = parseJWTUnsafe(token);
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch {
    return true;
  }
}

/**
 * Initialize session on app startup
 * Loads JWT from keychain, checks expiry, refreshes if needed
 */
export async function initializeSession(): Promise<SessionInfo> {
  console.log("[Session] Initializing...");

  try {
    // Load stored JWT
    const appJWT = await secureTokens.getAppJWT();

    if (!appJWT) {
      console.log("[Session] No stored JWT found");
      return { status: "unauthenticated" };
    }

    // Parse JWT to get user info
    const payload = parseJWTUnsafe(appJWT);
    console.log("[Session] Found JWT for user:", payload.userId);

    // Check if expired
    if (isJWTExpired(appJWT)) {
      console.log("[Session] JWT expired, attempting refresh...");

      // Try to refresh the session
      const refreshed = await refreshSession();

      if (!refreshed) {
        console.log("[Session] Refresh failed, session expired");
        return { status: "expired" };
      }

      return refreshed;
    }

    // JWT is still valid
    console.log("[Session] JWT is valid");

    const profile = await hydrateUserProfile(payload.userId, appJWT);

    return {
      status: "authenticated",
      userId: payload.userId,
      deviceId: payload.deviceId,
      provider: payload.provider as "google" | "github",
      appJWT,
      email: profile?.email ?? undefined,
      name: profile?.name ?? undefined,
      avatarUrl: profile?.avatarUrl ?? null,
    };
  } catch (error) {
    console.error("[Session] Initialization error:", error);
    return { status: "unauthenticated" };
  }
}

/**
 * Refresh the current session
 * Uses provider-specific refresh token to get new app JWT
 */
export async function refreshSession(): Promise<SessionInfo | null> {
  console.log("[Session] Refreshing...");

  try {
    // Get current JWT to determine provider
    const appJWT = await secureTokens.getAppJWT();
    if (!appJWT) {
      console.log("[Session] No JWT to refresh");
      return null;
    }

    const payload = parseJWTUnsafe(appJWT);
    const provider = payload.provider;
    const deviceId = payload.deviceId;

    // Refresh based on provider
    if (provider === "google") {
      const result = await refreshGoogleSession(deviceId);

      if (!result) {
        console.log("[Session] Google refresh failed");
        return null;
      }

      // Save new JWT
      await secureTokens.saveAppJWT(result.app_jwt);
      await secureTokens.saveUserId(result.user.id);

      console.log("[Session] Refreshed successfully");

      const profile = await persistProfileFromAuthResult({
        userId: result.user.id,
        email: result.user.email,
        name: result.user.name,
      });

      return {
        status: "authenticated",
        userId: result.user.id,
        deviceId,
        provider: "google",
        appJWT: result.app_jwt,
        email: profile?.email ?? result.user.email,
        name: profile?.name ?? result.user.name,
        avatarUrl: profile?.avatarUrl ?? null,
      };
    } else if (provider === "github") {
      const { refreshGitHubSession } = await import("./github");
      const result = await refreshGitHubSession(deviceId);

      if (!result) {
        console.log("[Session] GitHub refresh failed");
        return null;
      }

      // Save new JWT
      await secureTokens.saveAppJWT(result.app_jwt);
      await secureTokens.saveUserId(result.user.id);

      console.log("[Session] Refreshed successfully");

      const profile = await persistProfileFromAuthResult({
        userId: result.user.id,
        email: result.user.email,
        name: result.user.name,
      });

      return {
        status: "authenticated",
        userId: result.user.id,
        deviceId,
        provider: "github",
        appJWT: result.app_jwt,
        email: profile?.email ?? result.user.email,
        name: profile?.name ?? result.user.name,
        avatarUrl: profile?.avatarUrl ?? null,
      };
    } else {
      console.error("[Session] Unknown provider:", provider);
      return null;
    }
  } catch (error) {
    console.error("[Session] Refresh error:", error);
    return null;
  }
}

/**
 * Get a fresh Electric replication token
 * Call this before initializing Electric sync
 */
export async function getElectricToken(): Promise<string | null> {
  console.log("[Session] Getting Electric replication token...");

  try {
    // Get current app JWT
    let appJWT = await secureTokens.getAppJWT();

    if (!appJWT) {
      console.error("[Session] No app JWT available");
      return null;
    }

    // Check if expired, refresh if needed
    if (isJWTExpired(appJWT)) {
      console.log("[Session] JWT expired, refreshing...");
      const refreshed = await refreshSession();

      if (!refreshed || !refreshed.appJWT) {
        console.error("[Session] Failed to refresh JWT");
        return null;
      }

      appJWT = refreshed.appJWT;
    }

    // Request Electric token from Auth Broker
    const authBrokerUrl =
      import.meta.env.VITE_API_URL || "http://localhost:3000";
    const response = await fetch(`${authBrokerUrl}/api/replication/token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJWT}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Session] Electric token request failed:", error);
      return null;
    }

    const { electric_token } = await response.json();
    console.log("[Session] Got Electric replication token");

    return electric_token;
  } catch (error) {
    console.error("[Session] Electric token error:", error);
    return null;
  }
}

/**
 * Clear all session data
 * Call this when signing out
 */
export async function clearSession(): Promise<void> {
  console.log("[Session] Clearing all session data...");

  try {
    const { handleSignOut, getDeviceId } = await import("@deeprecall/data");
    const { TauriBlobStorage } = await import("../blob-storage/tauri");

    const deviceId = getDeviceId();
    const cas = new TauriBlobStorage();

    console.log("[Session] Running centralized sign-out flow...");
    await handleSignOut(deviceId, cas);

    // Clear secure tokens last
    await secureTokens.clearAll();
    cachedProfile = null;
    inFlightProfile = null;

    console.log("[Session] Cleared successfully");
  } catch (error) {
    console.error("[Session] Clear error:", error);
    await secureTokens.clearAll();
    cachedProfile = null;
    inFlightProfile = null;
    throw error;
  }
}

/**
 * Get current device ID (or generate if doesn't exist)
 */
export async function getOrCreateDeviceId(): Promise<string> {
  let deviceId = await secureTokens.getDeviceId();

  if (!deviceId) {
    deviceId = crypto.randomUUID();
    await secureTokens.saveDeviceId(deviceId);
    console.log("[Session] Generated new device ID:", deviceId);
  }

  return deviceId;
}

async function hydrateUserProfile(
  userId: string,
  appJWT: string
): Promise<StoredUserProfile | null> {
  if (cachedProfile && cachedProfile.userId === userId) {
    return cachedProfile;
  }

  const stored = await profileStore.get();

  if (stored && stored.userId === userId) {
    cachedProfile = stored;
    return stored;
  }

  if (!appJWT) {
    return null;
  }

  if (!inFlightProfile) {
    inFlightProfile = fetchRemoteProfile(userId, appJWT).finally(() => {
      inFlightProfile = null;
    });
  }

  const remote = await inFlightProfile;
  if (remote) {
    cachedProfile = remote;
  }
  return remote;
}

async function fetchRemoteProfile(
  userId: string,
  appJWT: string
): Promise<StoredUserProfile | null> {
  try {
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const response = await fetch(`${apiBase}/api/profile`, {
      headers: {
        Authorization: `Bearer ${appJWT}`,
      },
    });

    if (!response.ok) {
      console.warn("[Session] Profile fetch failed", response.status);
      return null;
    }

    const data = await response.json();
    const user = data?.user;

    if (!user) {
      return null;
    }

    const profile: StoredUserProfile = {
      userId: userId,
      email: user.email ?? null,
      name: user.displayName ?? user.name ?? null,
      avatarUrl: user.avatarUrl ?? null,
      updatedAt: user.updatedAt ?? new Date().toISOString(),
    };

    await profileStore.save(profile);
    return profile;
  } catch (error) {
    console.warn("[Session] Failed to hydrate profile", error);
    return null;
  }
}

async function persistProfileFromAuthResult(profile: {
  userId: string;
  email?: string;
  name?: string;
}): Promise<StoredUserProfile | null> {
  const stored: StoredUserProfile = {
    userId: profile.userId,
    email: profile.email ?? null,
    name: profile.name ?? null,
    avatarUrl: cachedProfile?.avatarUrl ?? null,
    updatedAt: new Date().toISOString(),
  };

  await profileStore.save(stored);
  cachedProfile = stored;
  return stored;
}
