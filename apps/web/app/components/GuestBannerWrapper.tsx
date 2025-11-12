/**
 * GuestBannerWrapper - Web platform wrapper for GuestBanner
 * Integrates with NextAuth session and checks for local data
 */

"use client";

import { GuestBanner } from "@deeprecall/ui";
import { useSession } from "@/src/auth/client";
import { hasGuestData, getDeviceId } from "@deeprecall/data";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function GuestBannerWrapper() {
  const { status } = useSession();
  const router = useRouter();
  const [hasLocalData, setHasLocalData] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      // Guest mode - check for local data
      const deviceId = getDeviceId();
      hasGuestData(deviceId)
        .then(setHasLocalData)
        .catch(() => setHasLocalData(false));
    } else {
      setHasLocalData(false);
    }
  }, [status]);

  const handleSignIn = () => {
    router.push("/auth/signin");
  };

  return (
    <GuestBanner
      isAuthenticated={status === "authenticated"}
      hasLocalData={hasLocalData}
      onSignIn={handleSignIn}
    />
  );
}
