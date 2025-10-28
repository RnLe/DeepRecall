/**
 * OrphanedBlobs Wrapper (Capacitor Mobile)
 * Provides orphaned blobs data from Capacitor CAS
 */

"use client";

import {
  OrphanedBlobs as OrphanedBlobsUI,
  type OrphanedBlobsOperations,
} from "@deeprecall/ui";
import { useOrphanedBlobs } from "@deeprecall/data/hooks";
import { useCapacitorBlobStorage } from "../../../hooks/useBlobStorage";

export function OrphanedBlobs() {
  const cas = useCapacitorBlobStorage();
  const { data: orphans = [], isLoading } = useOrphanedBlobs(cas);

  const operations: OrphanedBlobsOperations = {
    orphanedBlobs: orphans,
    isLoading,
    getBlobUrl: (sha256: string) => cas.getUrl(sha256),
    syncBlobToElectric: async (sha256: string) => {
      // For mobile, sync via HTTP API (same as web app)
      const apiBaseUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

      const response = await fetch(`${apiBaseUrl}/api/admin/sync-blob`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sha256 }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to sync blob");
      }
    },
  };

  return <OrphanedBlobsUI operations={operations} />;
}
