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
const PROFILE_KEY = "user_profile";

const fallbackKeysInUse = new Set<string>();
const pendingRehydrate = new Map<string, Promise<void>>();

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

function recordFallbackUsage(key: string) {
  if (!fallbackKeysInUse.has(key)) {
    fallbackKeysInUse.add(key);
    console.info(
      `[SecureStore] Using fallback storage for ${key} (keychain entry missing)`
    );
  } else {
    console.debug(`[SecureStore] Using cached fallback for ${key}`);
  }
}

function recordKeychainRecovery(key: string) {
  if (fallbackKeysInUse.delete(key)) {
    console.info(`[SecureStore] Keychain entry restored for ${key}`);
  }
}

function scheduleRehydrate(fullKey: string, key: string, value: string) {
  if (pendingRehydrate.has(fullKey)) {
    return;
  }

  const attempt = invoke("save_auth_session", { key: fullKey, value })
    .then(() => {
      console.info(`[SecureStore] Rehydrated keychain for ${key}`);
      fallbackKeysInUse.delete(key);
    })
    .catch((error) => {
      console.debug(`[SecureStore] Keychain still missing ${key}`, error);
    })
    .finally(() => {
      pendingRehydrate.delete(fullKey);
    });

  pendingRehydrate.set(fullKey, attempt);
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
    recordKeychainRecovery(key);
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
      recordKeychainRecovery(key);
      return value;
    }
    console.debug(`[SecureStore] Keychain returned empty for ${key}`);
  } catch (error) {
    console.error(`[SecureStore] Failed to get ${key}:`, error);
    console.warn(`[SecureStore] Falling back to local storage for ${key}`);
  }

  const fallbackValue = getFallback(key);

  if (fallbackValue) {
    recordFallbackUsage(key);
    scheduleRehydrate(fullKey, key, fallbackValue);
    return fallbackValue;
  }

  console.warn(`[SecureStore] No stored value for ${key}`);
  return null;
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
    PROFILE_KEY,
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

export interface StoredUserProfile {
  userId: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  updatedAt?: string | null;
}

async function saveProfile(profile: StoredUserProfile): Promise<void> {
  await save(PROFILE_KEY, JSON.stringify(profile));
}

async function getProfile(): Promise<StoredUserProfile | null> {
  const raw = await get(PROFILE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredUserProfile;
  } catch (error) {
    console.warn("[SecureStore] Failed to parse stored profile", error);
    return null;
  }
}

async function clearProfile(): Promise<void> {
  await deleteKey(PROFILE_KEY);
}

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

export const profileStore = {
  save: saveProfile,
  get: getProfile,
  clear: clearProfile,
};
