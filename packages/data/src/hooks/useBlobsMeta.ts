/**
 * Blob Metadata Hooks
 * React hooks for accessing blob metadata from Electric
 */

import type { BlobMeta } from "@deeprecall/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useShape } from "../electric";
import { db } from "../db";

/**
 * Sync Electric data to Dexie (replace entire table)
 * Follows pattern from migration doc - always sync even when empty
 */
async function syncElectricToDexie(electricData: BlobMeta[]): Promise<void> {
  await db.transaction("rw", db.blobsMeta, async () => {
    const currentIds = new Set(
      (await db.blobsMeta.toCollection().primaryKeys()) as string[]
    );
    const electricIds = new Set(electricData.map((e) => e.sha256));
    const idsToDelete = Array.from(currentIds).filter(
      (id) => !electricIds.has(id)
    );

    if (idsToDelete.length > 0) {
      await db.blobsMeta.bulkDelete(idsToDelete);
      console.log(
        `[Electric→Dexie] Deleted ${idsToDelete.length} stale blobs_meta`
      );
    }
    if (electricData.length > 0) {
      await db.blobsMeta.bulkPut(electricData);
      console.log(`[Electric→Dexie] Synced ${electricData.length} blobs_meta`);
    } else if (idsToDelete.length === 0 && currentIds.size === 0) {
      console.log(`[Electric→Dexie] blobs_meta: empty (no changes)`);
    }
  });
}

// ============================================================================
// Sync Hooks (Internal - Called by SyncManager only)
// ============================================================================

/**
 * Internal sync hook: Subscribes to Electric and syncs to Dexie
 * CRITICAL: Must only be called ONCE by SyncManager to prevent race conditions
 *
 * DO NOT call this from components! Use useBlobsMeta() instead.
 */
export function useBlobsMetaSync() {
  const electricResult = useShape<BlobMeta>({ table: "blobs_meta" });

  // Sync Electric data to Dexie
  useEffect(() => {
    if (
      !electricResult.isLoading &&
      electricResult.data !== undefined
      // Note: Sync even with stale cache data - having stale data is better than no data
    ) {
      syncElectricToDexie(electricResult.data).catch((error) => {
        if (error.name === "DatabaseClosedError") return;
        console.error(
          "[useBlobsMetaSync] Failed to sync Electric data to Dexie:",
          error
        );
      });
    }
  }, [electricResult.data, electricResult.isFreshData]);

  return null;
}

// ============================================================================
// Query Hooks (Public - Called by components)
// ============================================================================

/**
 * Get all blob metadata entries
 *
 * This is a READ-ONLY hook with no side effects.
 * Sync is handled by useBlobsMetaSync() in SyncManager.
 */
export function useBlobsMeta() {
  return useQuery({
    queryKey: ["blobs-meta", "merged"],
    queryFn: async () => {
      try {
        const data = await db.blobsMeta.toArray();
        return data;
      } catch (error) {
        console.error("[useBlobsMeta] Error:", error);
        return []; // Always return array, never undefined
      }
    },
    placeholderData: [], // Prevent hydration mismatch
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

/**
 * Get blob metadata by SHA-256 hash
 * READ-ONLY: No sync side effects (handled by useBlobsMetaSync)
 */
export function useBlobMeta(sha256: string | undefined) {
  return useQuery({
    queryKey: ["blobs-meta", "merged", sha256],
    queryFn: async () => {
      if (!sha256) return undefined;
      return db.blobsMeta.get(sha256);
    },
    enabled: !!sha256,
    staleTime: 0,
  });
}

/**
 * Get blobs by MIME type
 * READ-ONLY: No sync side effects (handled by useBlobsMetaSync)
 */
export function useBlobsMetaByMime(mime: string) {
  return useQuery({
    queryKey: ["blobs-meta", "merged", "mime", mime],
    queryFn: async () => {
      return db.blobsMeta.where("mime").equals(mime).toArray();
    },
    staleTime: 0,
  });
}
