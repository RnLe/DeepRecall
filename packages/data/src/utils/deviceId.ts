/**
 * Device ID Management
 *
 * Generates and persists a unique device identifier for tracking
 * blob presence across different devices in the Electric coordination layer.
 *
 * The device ID is stored in localStorage (Web) and will be stored in
 * platform-specific storage for Desktop/Mobile implementations.
 */

const DEVICE_ID_KEY = "deeprecall:deviceId";
const DEVICE_NAME_KEY = "deeprecall:deviceName";

/**
 * Get or create a persistent device ID for this device
 * The ID is stored in localStorage and persists across sessions
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") {
    // Server-side: use a fixed server ID
    return "server";
  }

  // Check if we already have a device ID
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    // Generate a new UUID for this device
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);

    // Also set a default device name
    const defaultName = `Web-${new Date().toISOString().slice(0, 10)}`;
    localStorage.setItem(DEVICE_NAME_KEY, defaultName);

    console.log(`[DeviceID] Generated new device ID: ${deviceId}`);
  }

  return deviceId;
}

/**
 * Get the human-readable device name
 */
export function getDeviceName(): string {
  if (typeof window === "undefined") {
    return "Server";
  }

  return localStorage.getItem(DEVICE_NAME_KEY) || "Unknown Device";
}

/**
 * Set a custom device name
 */
export function setDeviceName(name: string): void {
  if (typeof window === "undefined") {
    console.warn("[DeviceID] Cannot set device name on server");
    return;
  }

  localStorage.setItem(DEVICE_NAME_KEY, name);
  console.log(`[DeviceID] Updated device name to: ${name}`);
}

/**
 * Get device info (ID + name)
 */
export interface DeviceInfo {
  id: string;
  name: string;
}

export function getDeviceInfo(): DeviceInfo {
  return {
    id: getDeviceId(),
    name: getDeviceName(),
  };
}

/**
 * Reset device ID (useful for testing or re-initialization)
 * WARNING: This will lose track of this device's blob presence in Electric!
 */
export function resetDeviceId(): void {
  if (typeof window === "undefined") {
    console.warn("[DeviceID] Cannot reset device ID on server");
    return;
  }

  localStorage.removeItem(DEVICE_ID_KEY);
  localStorage.removeItem(DEVICE_NAME_KEY);
  console.log(
    "[DeviceID] Device ID reset - will generate new ID on next access"
  );
}
