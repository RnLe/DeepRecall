/**
 * Mobile-specific blob storage hook
 * Returns singleton instance of Capacitor BlobCAS
 */

import type { BlobCAS } from "@deeprecall/blob-storage";
import { CapacitorBlobStorage } from "../blob-storage/capacitor";

let casInstance: BlobCAS | null = null;

/**
 * Get singleton Capacitor blob storage instance
 *
 * Platform injection pattern:
 * - Web: useWebBlobStorage() → Next.js API routes
 * - Desktop: useTauriBlobStorage() → Rust commands
 * - Mobile: useCapacitorBlobStorage() → Capacitor Filesystem
 */
export function useCapacitorBlobStorage(): BlobCAS {
  if (!casInstance) {
    casInstance = new CapacitorBlobStorage();
    console.log("[useCapacitorBlobStorage] Created new CAS instance");
  }
  return casInstance;
}
