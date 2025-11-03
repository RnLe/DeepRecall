"use client";

import { useSystemMonitoring } from "@deeprecall/data/hooks";
import { useEffect, useState } from "react";

/**
 * Detect if running in Tauri (desktop) or Capacitor (mobile)
 */
function detectPlatform(): "web" | "desktop" | "mobile" {
  if (typeof window === "undefined") return "web";

  // Check for Tauri API
  if ("__TAURI__" in window || "__TAURI_INTERNALS__" in window) {
    return "desktop";
  }

  // Check for Capacitor API
  if ("Capacitor" in window) {
    return "mobile";
  }

  return "web";
}

/**
 * Get web server URL to monitor (for desktop/mobile)
 * Returns null for web (since we're already on the server)
 */
function getWebServerUrl(): string | null {
  const platform = detectPlatform();

  if (platform === "web") {
    return null; // Web app is served from the server, no need to check
  }

  // Desktop/mobile: monitor the Railway production server
  // In dev mode, Tauri loads localhost:3000, so monitor that
  // In production, Tauri/Capacitor loads Railway URL
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return null;
}

/**
 * System Monitoring Provider
 * Initializes system health monitoring (network, Electric, etc.)
 * Should be placed at app root, wraps all content.
 *
 * Automatically detects platform (web/desktop/mobile) and configures
 * web server monitoring for desktop/mobile apps.
 */
export function SystemMonitoringProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [webServerUrl, setWebServerUrl] = useState<string | null>(null);

  // Detect platform and set web server URL
  useEffect(() => {
    setWebServerUrl(getWebServerUrl());
  }, []);

  // Initialize monitoring on mount
  useSystemMonitoring({ webServerUrl: webServerUrl || undefined });

  return <>{children}</>;
}
