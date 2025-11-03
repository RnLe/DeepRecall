/**
 * System Initialization Hook
 *
 * Convenience hook that:
 * 1. Initializes system monitoring on mount
 * 2. Returns current system state for components
 * 3. Handles cleanup on unmount
 *
 * Call this once at the app root level to start monitoring.
 */

import { useEffect } from "react";
import { useSystemStore } from "../stores/systemStore";

export interface UseSystemMonitoringOptions {
  // For desktop/mobile: URL of web server to monitor
  webServerUrl?: string;
}

/**
 * Initialize system monitoring and return current state.
 * Call this at app root to start monitoring.
 */
export function useSystemMonitoring(options: UseSystemMonitoringOptions = {}) {
  const { webServerUrl } = options;

  // Configure web server URL (for desktop/mobile)
  useEffect(() => {
    if (webServerUrl) {
      useSystemStore.getState().setWebServerUrl(webServerUrl);
    }
  }, [webServerUrl]);

  // Initialize monitoring on mount
  useEffect(() => {
    const cleanup = useSystemStore.getState().initializeMonitoring();
    return cleanup;
  }, []);

  // Return current state for reactive updates
  const overallStatus = useSystemStore((state) => state.overallStatus);
  const isOnline = useSystemStore((state) => state.isOnline);
  const isElectricConnected = useSystemStore(
    (state) => state.isElectricConnected
  );

  return {
    overallStatus,
    isOnline,
    isElectricConnected,
  };
}

/**
 * Convenience hook to just get overall status
 * (without initializing monitoring - use after useSystemMonitoring)
 */
export function useConnectionStatus() {
  return useSystemStore((state) => state.overallStatus);
}
