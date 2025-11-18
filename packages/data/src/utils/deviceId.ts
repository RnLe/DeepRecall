/**
 * Device ID Management
 *
 * Generates and persists a unique device identifier for tracking
 * blob presence across different devices in the Electric coordination layer.
 *
 * PERSISTENCE STRATEGY:
 * - Web: localStorage (primary) + IndexedDB (durable fallback)
 * - Desktop: Tauri store (platform-specific persistent storage)
 * - Mobile: Capacitor Preferences (iOS/Android native storage)
 *
 * This ensures device IDs survive cache clears and app reinstalls.
 */

import { logger } from "@deeprecall/telemetry";

const DEVICE_ID_KEY = "deeprecall:deviceId";
const DEVICE_NAME_KEY = "deeprecall:deviceName";
const DEVICE_TYPE_KEY = "deeprecall:deviceType";

// Cache for device ID (avoid repeated async lookups)
let cachedDeviceId: string | null = null;
let cachedDeviceName: string | null = null;

/**
 * IndexedDB storage for device ID (Web fallback for when localStorage is cleared)
 */
async function getDeviceIdFromIndexedDB(): Promise<string | null> {
  try {
    const dbName = "deeprecall-device";
    const storeName = "device-info";

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const getRequest = store.get(DEVICE_ID_KEY);

        getRequest.onsuccess = () => {
          resolve(getRequest.result || null);
        };

        getRequest.onerror = () => {
          reject(getRequest.error);
        };
      };
    });
  } catch (error) {
    logger.error("ui", "[DeviceID] Failed to read from IndexedDB", { error });
    return null;
  }
}

/**
 * Save device ID to IndexedDB (Web durable storage)
 */
async function saveDeviceIdToIndexedDB(deviceId: string): Promise<void> {
  try {
    const dbName = "deeprecall-device";
    const storeName = "device-info";

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const putRequest = store.put(deviceId, DEVICE_ID_KEY);

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
    });
  } catch (error) {
    logger.error("ui", "[DeviceID] Failed to save to IndexedDB", { error });
  }
}

/**
 * Get device ID from platform-specific storage
 * Desktop (Tauri) and Mobile (Capacitor) will override this
 */
async function getDeviceIdFromPlatformStorage(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  // Desktop (Tauri)
  if ((window as any).__TAURI__) {
    try {
      // Use string concatenation to prevent bundler from trying to resolve in non-Tauri builds
      // @ts-ignore - Tauri plugin only available in desktop builds
      const modulePath = "@tauri-apps/plugin-" + "store";
      const { Store } = await import(
        /* @vite-ignore */ /* webpackIgnore: true */ modulePath as any
      );
      const store = new Store(".device.dat");
      const deviceId = await store.get(DEVICE_ID_KEY);
      return (deviceId as string) || null;
    } catch (error) {
      logger.error("ui", "[DeviceID] Tauri store not available", { error });
      return null;
    }
  }

  // Mobile (Capacitor)
  if ((window as any).Capacitor) {
    try {
      // Use string concatenation to prevent bundler from trying to resolve in non-Capacitor builds
      // @ts-ignore - Capacitor only available in mobile builds
      const modulePath = "@capacitor/prefer" + "ences";
      const { Preferences } = await import(
        /* @vite-ignore */ /* webpackIgnore: true */ modulePath as any
      );
      const { value } = await Preferences.get({ key: DEVICE_ID_KEY });
      return value;
    } catch (error) {
      logger.error("ui", "[DeviceID] Capacitor Preferences not available", {
        error,
      });
      return null;
    }
  }

  // Web: Try localStorage first, then IndexedDB
  const localStorageId = localStorage.getItem(DEVICE_ID_KEY);
  if (localStorageId) {
    return localStorageId;
  }

  const indexedDBId = await getDeviceIdFromIndexedDB();
  if (indexedDBId) {
    // Restore to localStorage for faster access
    localStorage.setItem(DEVICE_ID_KEY, indexedDBId);
    logger.info("ui", "[DeviceID] Restored from IndexedDB to localStorage");
  }

  return indexedDBId;
}

/**
 * Save device ID to platform-specific storage
 */
async function saveDeviceIdToPlatformStorage(
  deviceId: string,
  deviceName: string
): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  // Desktop (Tauri)
  if ((window as any).__TAURI__) {
    try {
      // Use string concatenation to prevent bundler from trying to resolve in non-Tauri builds
      // @ts-ignore - Tauri plugin only available in desktop builds
      const modulePath = "@tauri-apps/plugin-" + "store";
      const { Store } = await import(
        /* @vite-ignore */ /* webpackIgnore: true */ modulePath as any
      );
      const store = new Store(".device.dat");
      await store.set(DEVICE_ID_KEY, deviceId);
      await store.set(DEVICE_NAME_KEY, deviceName);
      await store.save();
      logger.info("ui", "[DeviceID] Saved to Tauri store");
      return;
    } catch (error) {
      logger.error("ui", "[DeviceID] Failed to save to Tauri store", { error });
    }
  }

  // Mobile (Capacitor)
  if ((window as any).Capacitor) {
    try {
      // Use string concatenation to prevent bundler from trying to resolve in non-Capacitor builds
      // @ts-ignore - Capacitor only available in mobile builds
      const modulePath = "@capacitor/prefer" + "ences";
      const { Preferences } = await import(
        /* @vite-ignore */ /* webpackIgnore: true */ modulePath as any
      );
      await Preferences.set({ key: DEVICE_ID_KEY, value: deviceId });
      await Preferences.set({ key: DEVICE_NAME_KEY, value: deviceName });
      logger.info("ui", "[DeviceID] Saved to Capacitor Preferences");
      return;
    } catch (error) {
      logger.error("ui", "[DeviceID] Failed to save to Capacitor Preferences", {
        error,
      });
    }
  }

  // Web: Save to both localStorage and IndexedDB
  localStorage.setItem(DEVICE_ID_KEY, deviceId);
  localStorage.setItem(DEVICE_NAME_KEY, deviceName);
  await saveDeviceIdToIndexedDB(deviceId);
  logger.info("ui", "[DeviceID] Saved to localStorage + IndexedDB");
}

/**
 * Get or create a persistent device ID for this device
 * Async version for reliable platform-specific storage
 */
export async function getDeviceIdAsync(): Promise<string> {
  if (typeof window === "undefined") {
    return "server";
  }

  // Return cached value if available
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  // Try to load from platform storage
  let deviceId = await getDeviceIdFromPlatformStorage();

  if (!deviceId) {
    // Generate new UUID
    deviceId = crypto.randomUUID();
    const deviceType = getDeviceType();
    const defaultName = `${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)}-${new Date().toISOString().slice(0, 10)}`;

    // Save to platform storage
    await saveDeviceIdToPlatformStorage(deviceId, defaultName);

    logger.info("ui", `[DeviceID] Generated new device ID: ${deviceId}`);
  }

  // Cache for subsequent calls
  cachedDeviceId = deviceId;
  return deviceId;
}

/**
 * Synchronous version (uses cache or localStorage only)
 * Use getDeviceIdAsync() for first access to ensure persistence
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  // Return cached if available
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  // Fallback to localStorage (fast but less reliable)
  const deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (deviceId) {
    cachedDeviceId = deviceId;
    return deviceId;
  }

  // If no device ID exists yet, generate one synchronously
  // (Note: This won't persist to platform storage, use getDeviceIdAsync() for that)
  const newDeviceId = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, newDeviceId);
  cachedDeviceId = newDeviceId;

  logger.warn(
    "ui",
    "[DeviceID] Generated device ID synchronously - may not persist. Use getDeviceIdAsync() for reliable persistence."
  );

  return newDeviceId;
}

/**
 * Get the human-readable device name
 */
export function getDeviceName(): string {
  if (typeof window === "undefined") {
    return "Server";
  }

  // Return cached if available
  if (cachedDeviceName) {
    return cachedDeviceName;
  }

  const name = localStorage.getItem(DEVICE_NAME_KEY) || "Unknown Device";
  cachedDeviceName = name;
  return name;
}

/**
 * Get device name from platform storage (async)
 */
export async function getDeviceNameAsync(): Promise<string> {
  if (typeof window === "undefined") {
    return "Server";
  }

  if (cachedDeviceName) {
    return cachedDeviceName;
  }

  // Desktop (Tauri)
  if ((window as any).__TAURI__) {
    try {
      // Use string concatenation to prevent bundler from trying to resolve in non-Tauri builds
      // @ts-ignore - Tauri plugin only available in desktop builds
      const modulePath = "@tauri-apps/plugin-" + "store";
      const { Store } = await import(
        /* @vite-ignore */ /* webpackIgnore: true */ modulePath as any
      );
      const store = new Store(".device.dat");
      const name = await store.get(DEVICE_NAME_KEY);
      if (name) {
        cachedDeviceName = name as string;
        return name as string;
      }
    } catch (error) {
      logger.error(
        "ui",
        "[DeviceID] Failed to read device name from Tauri store",
        { error }
      );
    }
  }

  // Mobile (Capacitor)
  if ((window as any).Capacitor) {
    try {
      // Use string concatenation to prevent bundler from trying to resolve in non-Capacitor builds
      // @ts-ignore - Capacitor only available in mobile builds
      const modulePath = "@capacitor/prefer" + "ences";
      const { Preferences } = await import(
        /* @vite-ignore */ /* webpackIgnore: true */ modulePath as any
      );
      const { value } = await Preferences.get({ key: DEVICE_NAME_KEY });
      if (value) {
        cachedDeviceName = value;
        return value;
      }
    } catch (error) {
      logger.error(
        "ui",
        "[DeviceID] Failed to read device name from Capacitor",
        { error }
      );
    }
  }

  // Fallback to localStorage
  const name = localStorage.getItem(DEVICE_NAME_KEY) || "Unknown Device";
  cachedDeviceName = name;
  return name;
}

/**
 * Set a custom device name
 */
export async function setDeviceName(name: string): Promise<void> {
  if (typeof window === "undefined") {
    logger.warn("ui", "[DeviceID] Cannot set device name on server");
    return;
  }

  // Update cache
  cachedDeviceName = name;

  // Desktop (Tauri)
  if ((window as any).__TAURI__) {
    try {
      // Use string concatenation to prevent bundler from trying to resolve in non-Tauri builds
      // @ts-ignore - Tauri plugin only available in desktop builds
      const modulePath = "@tauri-apps/plugin-" + "store";
      const { Store } = await import(
        /* @vite-ignore */ /* webpackIgnore: true */ modulePath as any
      );
      const store = new Store(".device.dat");
      await store.set(DEVICE_NAME_KEY, name);
      await store.save();
      logger.info(
        "ui",
        `[DeviceID] Updated device name to: ${name} (Tauri store)`
      );
      return;
    } catch (error) {
      logger.error(
        "ui",
        "[DeviceID] Failed to save device name to Tauri store",
        { error }
      );
    }
  }

  // Mobile (Capacitor)
  if ((window as any).Capacitor) {
    try {
      // Use string concatenation to prevent bundler from trying to resolve in non-Capacitor builds
      // @ts-ignore - Capacitor only available in mobile builds
      const modulePath = "@capacitor/prefer" + "ences";
      const { Preferences } = await import(
        /* @vite-ignore */ /* webpackIgnore: true */ modulePath as any
      );
      await Preferences.set({ key: DEVICE_NAME_KEY, value: name });
      logger.info(
        "ui",
        `[DeviceID] Updated device name to: ${name} (Capacitor)`
      );
      return;
    } catch (error) {
      logger.error("ui", "[DeviceID] Failed to save device name to Capacitor", {
        error,
      });
    }
  }

  // Web: Save to localStorage
  localStorage.setItem(DEVICE_NAME_KEY, name);
  logger.info(
    "ui",
    `[DeviceID] Updated device name to: ${name} (localStorage)`
  );
}

/**
 * Device type
 */
export type DeviceType = "web" | "desktop" | "mobile" | "server";

/**
 * Detect current device type
 */
export function getDeviceType(): DeviceType {
  if (typeof window === "undefined") {
    return "server";
  }

  // Check for Tauri (Desktop)
  if ((window as any).__TAURI__) {
    return "desktop";
  }

  // Check for Capacitor (Mobile)
  if ((window as any).Capacitor) {
    return "mobile";
  }

  // Default to web
  return "web";
}

/**
 * Get device info (ID + name + type)
 */
export interface DeviceInfo {
  id: string;
  name: string;
  type: DeviceType;
}

/**
 * Synchronous device info (uses cache)
 */
export function getDeviceInfo(): DeviceInfo {
  return {
    id: getDeviceId(),
    name: getDeviceName(),
    type: getDeviceType(),
  };
}

/**
 * Async device info (reads from platform storage)
 * Use this on app initialization to ensure data is loaded
 */
export async function getDeviceInfoAsync(): Promise<DeviceInfo> {
  return {
    id: await getDeviceIdAsync(),
    name: await getDeviceNameAsync(),
    type: getDeviceType(),
  };
}

/**
 * Initialize device ID on app startup
 * Call this early in your app lifecycle to ensure device ID is loaded and cached
 *
 * @example
 * // In app entry point (main.tsx, _app.tsx, etc.)
 * import { initializeDeviceId } from "@deeprecall/data";
 *
 * initializeDeviceId().then(() => {
 *   logger.info("ui", "Device ID initialized");
 * });
 */
export async function initializeDeviceId(): Promise<DeviceInfo> {
  const info = await getDeviceInfoAsync();
  logger.info(
    "ui",
    `[DeviceID] Initialized - ID: ${info.id}, Name: ${info.name}, Type: ${info.type}`
  );
  return info;
}

/**
 * Reset device ID (useful for testing or re-initialization)
 * WARNING: This will lose track of this device's blob presence in Electric!
 */
export function resetDeviceId(): void {
  if (typeof window === "undefined") {
    logger.warn("ui", "[DeviceID] Cannot reset device ID on server");
    return;
  }

  localStorage.removeItem(DEVICE_ID_KEY);
  localStorage.removeItem(DEVICE_NAME_KEY);
  logger.info(
    "ui",
    "[DeviceID] Device ID reset - will generate new ID on next access"
  );
}
