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

/**
 * Get all blob metadata entries
 * Uses syncElectricToDexie pattern for proper persistence
 */
export function useBlobsMeta() {
  const electricResult = useShape<BlobMeta>({ table: "blobs_meta" });

  // Sync Electric → Dexie (critical: sync even when empty!)
  useEffect(() => {
    if (electricResult.data !== undefined) {
      syncElectricToDexie(electricResult.data).catch((error) => {
        console.error("[Electric→Dexie] Failed to sync blobs_meta:", error);
      });
    }
  }, [electricResult.data]);

  // Return merged data from Dexie (persists across navigation)
  return useQuery({
    queryKey: ["blobs-meta", "merged"],
    queryFn: async () => {
      const data = await db.blobsMeta.toArray();
      return data;
    },
    initialData: [],
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

/**
 * Get blob metadata by SHA-256 hash
 */
export function useBlobMeta(sha256: string | undefined) {
  const result = useShape<BlobMeta>({
    table: "blobs_meta",
    where: sha256 ? `sha256 = '${sha256}'` : undefined,
  });
  return { ...result, data: result.data?.[0] };
}

/**
 * Get blobs by MIME type
 */
export function useBlobsMetaByMime(mime: string) {
  return useShape<BlobMeta>({
    table: "blobs_meta",
    where: `mime = '${mime}'`,
  });
}
