/**
 * Secure storage wrapper for desktop app
 * Uses OS keychain via Tauri commands
 * - macOS: Keychain
 * - Windows: Credential Manager
 * - Linux: Secret Service API
 */

import { invoke } from "@tauri-apps/api/core";

const FALLBACK_PREFIX = "deeprecall.auth.";

const KEYCHAIN_SERVICE = "dev.deeprecall.desktop";

function hasFallbackStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function saveFallback(key: string, value: string) {
  if (!hasFallbackStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(`${FALLBACK_PREFIX}${key}`, value);
    console.log(`[SecureStore] Saved fallback for ${key}`);
  } catch (error) {
    console.warn(`[SecureStore] Failed to save fallback for ${key}:`, error);
  }
}

function getFallback(key: string): string | null {
  if (!hasFallbackStorage()) {
    return null;
  }

  try {
    const value = window.localStorage.getItem(`${FALLBACK_PREFIX}${key}`);
    if (value) {
      console.log(`[SecureStore] Retrieved fallback for ${key}`);
    }
    return value;
  } catch (error) {
    console.warn(`[SecureStore] Failed to get fallback for ${key}:`, error);
    return null;
  }
}

function clearFallback(key: string) {
  if (!hasFallbackStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(`${FALLBACK_PREFIX}${key}`);
    console.log(`[SecureStore] Cleared fallback for ${key}`);
  } catch (error) {
    console.warn(`[SecureStore] Failed to clear fallback for ${key}:`, error);
  }
}

export interface SecureStore {
  save(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Save a value securely to the OS keychain
 */
async function save(key: string, value: string): Promise<void> {
  const fullKey = `${KEYCHAIN_SERVICE}.${key}`;

  try {
    await invoke("save_auth_session", {
      key: fullKey,
      value: value,
    });
    console.log(`[SecureStore] Saved ${key} to keychain`);
  } catch (error) {
    console.error(`[SecureStore] Failed to save ${key}:`, error);
    console.warn(`[SecureStore] Falling back to local storage for ${key}`);
  }

  // Always copy to fallback storage to keep session alive even if keychain fails
  saveFallback(key, value);
}

/**
 * Get a value from the OS keychain
 */
async function get(key: string): Promise<string | null> {
  const fullKey = `${KEYCHAIN_SERVICE}.${key}`;

  try {
    const value = await invoke<string | null>("get_auth_session", {
      key: fullKey,
    });

    if (value) {
      console.log(`[SecureStore] Retrieved ${key} from keychain`);
      return value;
    }

    console.warn(`[SecureStore] No value found for ${key}, checking fallback`);
  } catch (error) {
    console.error(`[SecureStore] Failed to get ${key}:`, error);
    console.warn(`[SecureStore] Falling back to local storage for ${key}`);
  }

  return getFallback(key);
}

/**
 * Delete a value from the OS keychain
 */
async function deleteKey(key: string): Promise<void> {
  const fullKey = `${KEYCHAIN_SERVICE}.${key}`;

  try {
    await invoke("clear_auth_session", {
      key: fullKey,
    });
    console.log(`[SecureStore] Deleted ${key} from keychain`);
  } catch (error) {
    console.error(`[SecureStore] Failed to delete ${key}:`, error);
    console.warn(`[SecureStore] Continuing with fallback deletion for ${key}`);
  }

  clearFallback(key);
}

/**
 * Clear all authentication data from keychain
 */
async function clear(): Promise<void> {
  const keys = [
    "app_jwt",
    "google_refresh_token",
    "github_refresh_token",
    "user_id",
    "device_id",
  ];

  for (const key of keys) {
    try {
      await deleteKey(key);
    } catch (error) {
      // Continue clearing other keys even if one fails
      console.warn(`[SecureStore] Failed to clear ${key}:`, error);
    }

    clearFallback(key);
  }

  console.log("[SecureStore] Cleared all auth data");
}

/**
 * Secure storage singleton
 */
export const secureStore: SecureStore = {
  save,
  get,
  delete: deleteKey,
  clear,
};

/**
 * Token-specific helpers
 */
export const tokens = {
  async saveAppJWT(jwt: string): Promise<void> {
    await save("app_jwt", jwt);
  },

  async getAppJWT(): Promise<string | null> {
    return await get("app_jwt");
  },

  async saveGoogleRefreshToken(token: string): Promise<void> {
    await save("google_refresh_token", token);
  },

  async getGoogleRefreshToken(): Promise<string | null> {
    return await get("google_refresh_token");
  },

  async saveGitHubRefreshToken(token: string): Promise<void> {
    await save("github_refresh_token", token);
  },

  async getGitHubRefreshToken(): Promise<string | null> {
    return await get("github_refresh_token");
  },

  async saveUserId(userId: string): Promise<void> {
    await save("user_id", userId);
  },

  async getUserId(): Promise<string | null> {
    return await get("user_id");
  },

  async saveDeviceId(deviceId: string): Promise<void> {
    await save("device_id", deviceId);
  },

  async getDeviceId(): Promise<string | null> {
    return await get("device_id");
  },

  async clearAll(): Promise<void> {
    await clear();
  },
};
