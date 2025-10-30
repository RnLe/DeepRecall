import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.renlephy.deeprecall",
  appName: "DeepRecall",
  webDir: "dist",
  server: {
    androidScheme: "https",
    iosScheme: "https",
    allowNavigation: ["deeprecall-production.up.railway.app"],
  },
  ios: {
    contentInset: "automatic",
    scrollEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
