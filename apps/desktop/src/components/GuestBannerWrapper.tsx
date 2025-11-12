/**
 * GuestBannerWrapper - Desktop platform wrapper for GuestBanner
 * Integrates with Tauri session and checks for local data
 */

import { GuestBannerCompact } from "@deeprecall/ui";
import { initializeSession } from "../auth";
import { hasGuestData, getDeviceId } from "@deeprecall/data";
import { useEffect, useState } from "react";

export function GuestBannerWrapper() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasLocalData, setHasLocalData] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const session = await initializeSession();
      const deviceId = getDeviceId();

      setIsAuthenticated(session.status === "authenticated");

      if (session.status !== "authenticated") {
        // Guest mode - check for local data
        const hasData = await hasGuestData(deviceId);
        setHasLocalData(hasData);
      } else {
        setHasLocalData(false);
      }
    }

    checkAuth();
  }, []);

  const handleSignIn = () => {
    // Desktop opens OAuth flow
    // This will be handled by UserMenu component
    window.location.href = "#sign-in";
  };

  return (
    <GuestBannerCompact
      isAuthenticated={isAuthenticated}
      hasLocalData={hasLocalData}
      onSignIn={handleSignIn}
    />
  );
}
