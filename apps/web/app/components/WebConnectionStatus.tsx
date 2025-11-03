"use client";

import { ConnectionStatusIndicator } from "@deeprecall/ui";
import { useConnectionStatus } from "@deeprecall/data/hooks";
import { useEffect, useState } from "react";

/**
 * Detect if running in desktop/mobile (Tauri/Capacitor)
 */
function isDesktopOrMobile(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "__TAURI__" in window ||
    "__TAURI_INTERNALS__" in window ||
    "Capacitor" in window
  );
}

/**
 * Connection status indicator
 * - Web: shows 3 states (synced, syncing, offline) - server always reachable
 * - Desktop/Mobile: shows all 4 states including server-down
 */
export function WebConnectionStatus() {
  const status = useConnectionStatus();
  const [isPlatformApp, setIsPlatformApp] = useState(false);

  // Detect if running in desktop/mobile
  useEffect(() => {
    setIsPlatformApp(isDesktopOrMobile());
  }, []);

  // Web app: hide server-down state (we're served from the server)
  // Desktop/Mobile: show all states
  const displayStatus =
    !isPlatformApp && status === "server-down" ? "synced" : status;

  return <ConnectionStatusIndicator status={displayStatus} />;
}
