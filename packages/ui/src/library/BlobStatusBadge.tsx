/**
 * BlobStatusBadge Component
 * Shows blob availability status across devices
 *
 * USAGE in platform pages (apps/web, apps/desktop, apps/mobile):
 *
 * ```tsx
 * // In page component:
 * import { BlobStatusBadge } from "@deeprecall/ui/library";
 * import { useWebBlobStorage } from "@/hooks/useBlobStorage"; // or useTauriBlobStorage, etc.
 *
 * function LibraryPage() {
 *   const cas = useWebBlobStorage();
 *   const { data: assets } = useAssets();
 *
 *   return (
 *     <div>
 *       {assets.map(asset => (
 *         <div key={asset.id}>
 *           <h3>{asset.filename}</h3>
 *           <BlobStatusBadge sha256={asset.sha256} cas={cas} />
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */

import { useEffect, useState } from "react";
import type { BlobCAS } from "@deeprecall/blob-storage";
import {
  useDeviceBlobsByHash,
  getDeviceId,
  useDeviceBlobs,
} from "@deeprecall/data";

interface BlobStatusBadgeProps {
  sha256: string;
  cas?: BlobCAS;
  className?: string;
}

/**
 * Badge showing blob availability status
 *
 * @example
 * <BlobStatusBadge sha256={asset.sha256} cas={cas} />
 * // => 📱 Local • 3 devices
 */
export function BlobStatusBadge({
  sha256,
  cas,
  className = "",
}: BlobStatusBadgeProps) {
  const [isLocal, setIsLocal] = useState(false);
  const [isStable, setIsStable] = useState(false); // Track if data has been stable
  const { data: deviceBlobs = [], isLoading: isLoadingHash } =
    useDeviceBlobsByHash(sha256);
  const { isLoading: isLoadingAll } = useDeviceBlobs(); // Check overall sync status
  const currentDeviceId = getDeviceId();

  useEffect(() => {
    // Use device_blobs table as the source of truth
    // No need to verify with CAS - trust the coordinated database
    const deviceHasBlob = deviceBlobs.some(
      (d) => d.deviceId === currentDeviceId && d.present
    );

    setIsLocal(deviceHasBlob);

    // Wait 500ms after data changes to consider it "stable"
    // This prevents flashing during Electric's initial sync burst
    setIsStable(false);
    const timer = setTimeout(() => setIsStable(true), 500);
    return () => clearTimeout(timer);
  }, [sha256, deviceBlobs, currentDeviceId]);

  const deviceCount = deviceBlobs.filter((d) => d.present).length;

  // Show loading state while:
  // 1. Electric is syncing OR
  // 2. Data is still settling (prevents flash during initial sync burst)
  if (isLoadingHash || isLoadingAll || !isStable) {
    return (
      <span className={`text-xs text-muted-foreground ${className}`}>
        ⏳ Loading...
      </span>
    );
  }

  if (deviceCount === 0 && !isLocal) {
    // No devices have this blob (orphaned metadata)
    return (
      <span className={`text-xs text-muted-foreground ${className}`}>
        ⚠️ Not available
      </span>
    );
  }

  return (
    <span
      className={`text-xs ${isLocal ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"} ${className}`}
    >
      {isLocal ? "📱 Local" : "☁️ Remote"} • {deviceCount} device
      {deviceCount !== 1 ? "s" : ""}
    </span>
  );
}

/**
 * Compact availability indicator (icon only)
 */
export function BlobAvailabilityIcon({
  sha256,
  cas,
  className = "",
}: BlobStatusBadgeProps) {
  const [isLocal, setIsLocal] = useState(false);
  const { data: deviceBlobs = [], isLoading } = useDeviceBlobsByHash(sha256);
  const currentDeviceId = getDeviceId();

  useEffect(() => {
    // Use device_blobs table as the source of truth
    // No need to verify with CAS - trust the coordinated database
    const deviceHasBlob = deviceBlobs.some(
      (d) => d.deviceId === currentDeviceId && d.present
    );

    setIsLocal(deviceHasBlob);
  }, [sha256, deviceBlobs, currentDeviceId]);

  return (
    <span
      className={`text-sm ${className}`}
      title={isLocal ? "Available locally" : "Available on other devices"}
    >
      {isLocal ? "📱" : "☁️"}
    </span>
  );
}
