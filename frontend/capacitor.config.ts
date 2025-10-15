import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.deeprecall.app',
  appName: 'DeepRecall',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // Enable haptic feedback for pen interactions
    Haptics: {
      enabled: true
    },
    // File system access for offline annotation storage
    Filesystem: {
      enabled: true
    },
    // App preferences for settings
    Preferences: {
      enabled: true
    },
    // App lifecycle management
    App: {
      enabled: true
    }
  },
  ios: {
    // Configure iOS-specific settings
    scheme: 'DeepRecall',
    contentInset: 'automatic',
    // Enable background modes if needed for sync
    backgroundMode: 'never'
  }
};

export default config;
