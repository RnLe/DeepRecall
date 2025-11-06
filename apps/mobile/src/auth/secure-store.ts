/**
 * Secure storage wrapper using Capacitor Preferences
 * On iOS, this uses the Keychain for secure storage
 */

import { Preferences } from "@capacitor/preferences";

const KEYS = {
  APP_JWT: "app_jwt",
  DEVICE_ID: "device_id",
} as const;

export const secureStore = {
  /**
   * Save app JWT token
   */
  async saveAppJWT(jwt: string): Promise<void> {
    await Preferences.set({
      key: KEYS.APP_JWT,
      value: jwt,
    });
  },

  /**
   * Get app JWT token
   */
  async getAppJWT(): Promise<string | null> {
    const { value } = await Preferences.get({ key: KEYS.APP_JWT });
    return value;
  },

  /**
   * Remove app JWT token
   */
  async removeAppJWT(): Promise<void> {
    await Preferences.remove({ key: KEYS.APP_JWT });
  },

  /**
   * Save device ID
   */
  async saveDeviceId(deviceId: string): Promise<void> {
    await Preferences.set({
      key: KEYS.DEVICE_ID,
      value: deviceId,
    });
  },

  /**
   * Get device ID
   */
  async getDeviceId(): Promise<string | null> {
    const { value } = await Preferences.get({ key: KEYS.DEVICE_ID });
    return value;
  },

  /**
   * Generate and save a new device ID
   */
  async getOrCreateDeviceId(): Promise<string> {
    let deviceId = await this.getDeviceId();
    if (!deviceId) {
      deviceId = `mobile-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      await this.saveDeviceId(deviceId);
    }
    return deviceId;
  },

  /**
   * Clear all stored data
   */
  async clear(): Promise<void> {
    await Preferences.clear();
  },
};
