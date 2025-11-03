/**
 * System Store
 *
 * Global state for system-level monitoring and health checks:
 * - Network connectivity (online/offline)
 * - Web server reachability (for desktop/mobile apps)
 * - Electric sync connection status
 * - Postgres database availability
 *
 * This store manages event listeners and polling internally,
 * so components can simply subscribe to derived state.
 */

import { create } from "zustand";

export type OverallConnectionStatus =
  | "synced" // All systems operational
  | "syncing" // Connected but sync in progress / degraded
  | "offline" // No internet connection
  | "server-down"; // Internet OK but web server unreachable

export interface SystemState {
  // Network layer
  isOnline: boolean;

  // Server layer (for desktop/mobile checking web server)
  isWebServerReachable: boolean | null; // null = not applicable (web app itself)
  webServerUrl: string | null; // URL to check (set by platform)

  // Data layer
  isElectricConnected: boolean;
  isPostgresAvailable: boolean;

  // Derived status
  overallStatus: OverallConnectionStatus;

  // Actions
  setOnline: (online: boolean) => void;
  setWebServerReachable: (reachable: boolean) => void;
  setWebServerUrl: (url: string | null) => void;
  setElectricConnected: (connected: boolean) => void;
  setPostgresAvailable: (available: boolean) => void;

  // Initialize monitoring (call once on app startup)
  initializeMonitoring: () => void;
}

/**
 * Compute overall connection status from individual states
 */
function computeOverallStatus(state: {
  isOnline: boolean;
  isWebServerReachable: boolean | null;
  isElectricConnected: boolean;
  isPostgresAvailable: boolean;
}): OverallConnectionStatus {
  // No internet connection
  if (!state.isOnline) {
    return "offline";
  }

  // Desktop/mobile: web server unreachable
  if (state.isWebServerReachable === false) {
    return "server-down";
  }

  // Electric disconnected or Postgres unavailable
  if (!state.isElectricConnected || !state.isPostgresAvailable) {
    return "syncing";
  }

  // All systems operational
  return "synced";
}

export const useSystemStore = create<SystemState>((set, get) => ({
  // Initial state
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  isWebServerReachable: null,
  webServerUrl: null,
  isElectricConnected: false,
  isPostgresAvailable: true,
  overallStatus: "syncing",

  // Actions
  setOnline: (online) =>
    set((state) => {
      const newState = { ...state, isOnline: online };
      return {
        isOnline: online,
        overallStatus: computeOverallStatus(newState),
      };
    }),

  setWebServerReachable: (reachable) =>
    set((state) => {
      const newState = { ...state, isWebServerReachable: reachable };
      return {
        isWebServerReachable: reachable,
        overallStatus: computeOverallStatus(newState),
      };
    }),

  setWebServerUrl: (url) => set({ webServerUrl: url }),

  setElectricConnected: (connected) =>
    set((state) => {
      const newState = { ...state, isElectricConnected: connected };
      return {
        isElectricConnected: connected,
        overallStatus: computeOverallStatus(newState),
      };
    }),

  setPostgresAvailable: (available) =>
    set((state) => {
      const newState = { ...state, isPostgresAvailable: available };
      return {
        isPostgresAvailable: available,
        overallStatus: computeOverallStatus(newState),
      };
    }),

  initializeMonitoring: () => {
    // Only initialize once
    if (typeof window === "undefined") return;

    const state = get();

    // Set up online/offline event listeners
    const handleOnline = () => state.setOnline(true);
    const handleOffline = () => state.setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Set up web server polling (if URL configured)
    let serverCheckInterval: NodeJS.Timeout | null = null;

    const startServerPolling = () => {
      const { webServerUrl, isOnline } = get();

      // Stop existing polling
      if (serverCheckInterval) {
        clearInterval(serverCheckInterval);
        serverCheckInterval = null;
      }

      // Only poll if URL configured and online
      if (!webServerUrl || !isOnline) {
        if (webServerUrl) {
          state.setWebServerReachable(false);
        }
        return;
      }

      const checkServer = async () => {
        const { webServerUrl, isOnline } = get();
        if (!webServerUrl || !isOnline) return;

        try {
          // HEAD request to minimize bandwidth
          const response = await fetch(webServerUrl, {
            method: "HEAD",
            mode: "no-cors",
            cache: "no-cache",
          });

          // no-cors returns opaque response
          // If fetch doesn't throw, server is reachable
          state.setWebServerReachable(true);
        } catch (error) {
          state.setWebServerReachable(false);
        }
      };

      // Check immediately
      checkServer();

      // Poll every 30 seconds
      serverCheckInterval = setInterval(checkServer, 30000);
    };

    // Start server polling
    startServerPolling();

    // Restart polling when online status changes
    const unsubscribe = useSystemStore.subscribe((currentState) => {
      const { isOnline } = currentState;
      if (isOnline) {
        startServerPolling();
      } else if (serverCheckInterval) {
        clearInterval(serverCheckInterval);
        serverCheckInterval = null;
      }
    });

    // Cleanup function (return it so it can be called on unmount if needed)
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (serverCheckInterval) {
        clearInterval(serverCheckInterval);
      }
      unsubscribe();
    };
  },
}));

/**
 * Convenience selectors
 */
export const selectOverallStatus = (state: SystemState) => state.overallStatus;
export const selectIsOnline = (state: SystemState) => state.isOnline;
export const selectIsElectricConnected = (state: SystemState) =>
  state.isElectricConnected;
