/**
 * Capacitor Preferences Polyfill for Browser
 *
 * When running in browser (not in Capacitor native context),
 * this polyfill provides a fallback using localStorage.
 */

interface PreferencesPlugin {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

// Check if we're in a Capacitor native context
const isNative = () => {
  return (
    typeof window !== "undefined" &&
    "Capacitor" in window &&
    (window as any).Capacitor?.isNativePlatform?.()
  );
};

export const Preferences: PreferencesPlugin = {
  async get(options: { key: string }) {
    if (isNative()) {
      // Use real Capacitor plugin
      const { Preferences } = await import("@capacitor/preferences");
      return Preferences.get(options);
    }

    // Browser fallback: use localStorage
    const value = localStorage.getItem(options.key);
    return { value };
  },

  async set(options: { key: string; value: string }) {
    if (isNative()) {
      const { Preferences } = await import("@capacitor/preferences");
      return Preferences.set(options);
    }

    // Browser fallback: use localStorage
    localStorage.setItem(options.key, options.value);
  },

  async remove(options: { key: string }) {
    if (isNative()) {
      const { Preferences } = await import("@capacitor/preferences");
      return Preferences.remove(options);
    }

    // Browser fallback: use localStorage
    localStorage.removeItem(options.key);
  },
};
