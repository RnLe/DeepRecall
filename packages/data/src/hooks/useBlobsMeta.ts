/**
 * Blob Metadata Hooks
 * React hooks for accessing blob metadata from Electric
 */

import type { BlobMeta } from "@deeprecall/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useShape } from "../electric";
import * as blobsMetaElectric from "../repos/blobs-meta.electric";
import { db } from "../db";
import { logger } from "@deeprecall/telemetry";

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
      logger.info("cas", "Deleted stale blobs_meta from Dexie", {
        count: idsToDelete.length,
        ids: idsToDelete,
      });
    }
    if (electricData.length > 0) {
      await db.blobsMeta.bulkPut(electricData);
      logger.info("cas", "Synced blobs_meta from Electric to Dexie", {
        count: electricData.length,
      });
    } else if (idsToDelete.length === 0 && currentIds.size === 0) {
      logger.info("cas", "blobs_meta table empty", { count: 0 });
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
 * @param userId - Owner filter for multi-tenant isolation (undefined = guest, skip sync)
 */
export function useBlobsMetaSync(userId?: string) {
  // SECURITY: Skip Electric sync for guests (userId undefined)
  // Guests work with local CAS only, no blob metadata coordination
  const electricResult = blobsMetaElectric.useBlobsMeta(userId);
  const queryClient = useQueryClient();

  // Sync Electric data to Dexie (only when authenticated)
  useEffect(() => {
    // Skip sync if no userId (guest mode)
    if (!userId) {
      return;
    }

    if (
      !electricResult.isLoading &&
      electricResult.data !== undefined
      // Note: Sync even with stale cache data - having stale data is better than no data
    ) {
      syncElectricToDexie(electricResult.data)
        .then(() => {
          // Refresh all blobs_meta queries to pick up the latest Dexie data
          queryClient.invalidateQueries({ queryKey: ["blobs-meta"] });
        })
        .catch((error) => {
          if (error.name === "DatabaseClosedError") return;
          logger.error("cas", "Failed to sync blobs_meta to Dexie", {
            error: (error as Error).message,
          });
        });
    }
  }, [userId, electricResult.data, electricResult.isFreshData, queryClient]);

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
        logger.error("cas", "Failed to query blobs_meta", {
          error: (error as Error).message,
        });
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

// ============================================================================
// Blob Resolution Hooks (Bridge Layer - Platform Agnostic)
// ============================================================================

/**
 * Resolve blob for frontend display
 * Combines Electric metadata + CAS availability
 *
 * @param sha256 - Blob SHA-256 hash
 * @param cas - Platform-specific CAS adapter (injected)
 * @returns Blob metadata with availability and URL
 *
 * @example
 * const cas = useWebBlobStorage();
 * const blob = useBlobResolution(sha256, cas);
 * if (blob.data?.availableLocally) {
 *   return <img src={blob.data.url} />;
 * }
 */
export function useBlobResolution(
  sha256: string | undefined,
  cas: {
    has: (sha256: string) => Promise<boolean>;
    getUrl: (sha256: string) => string;
  }
) {
  const { data: meta } = useBlobMeta(sha256);

  return useQuery({
    queryKey: ["blob", "resolution", sha256],
    queryFn: async () => {
      if (!meta || !sha256) return null;

      const availableLocally = await cas.has(sha256);
      const url = availableLocally ? cas.getUrl(sha256) : null;

      return {
        sha256,
        filename: meta.filename,
        mime: meta.mime,
        size: meta.size,
        createdAt: meta.createdAt,
        availableLocally,
        url,
      };
    },
    enabled: !!meta && !!sha256,
    staleTime: 5000, // Cache for 5 seconds (availability rarely changes)
  });
}

/**
 * Check blob availability status
 * Lightweight query for status badges
 *
 * @param sha256 - Blob SHA-256 hash
 * @param cas - Platform-specific CAS adapter
 * @returns Boolean availability status
 */
export function useBlobAvailability(
  sha256: string | undefined,
  cas: { has: (sha256: string) => Promise<boolean> }
) {
  return useQuery({
    queryKey: ["blob", "availability", sha256],
    queryFn: async () => {
      if (!sha256) return false;
      return cas.has(sha256);
    },
    enabled: !!sha256,
    staleTime: 5000,
  });
}

/**
 * Get unified blob list combining CAS + Electric metadata
 * Used by Admin panel to show complete picture
 *
 * @param cas - Platform-specific CAS adapter
 * @returns Combined list of blobs with metadata (CAS structure with Electric overrides)
 *
 * @example
 * const cas = useWebBlobStorage();
 * const { data: blobs } = useUnifiedBlobList(cas);
 */
export function useUnifiedBlobList(cas: {
  list: () => Promise<
    Array<{
      sha256: string;
      filename: string | null;
      size: number;
      mime: string;
      created_ms: number;
      mtime_ms: number;
      path: string | null;
      [key: string]: any;
    }>
  >;
}) {
  const { data: electricMeta = [] } = useBlobsMeta();

  return useQuery({
    queryKey: ["blobs", "unified"],
    queryFn: async () => {
      // Query local CAS (platform-specific storage)
      const localBlobs = await cas.list();

      // Create map of Electric metadata
      const metaMap = new Map(electricMeta.map((m) => [m.sha256, m]));

      // Merge: Keep CAS structure, overlay Electric metadata where available
      const unified = localBlobs.map((blob) => {
        const meta = metaMap.get(blob.sha256);

        // If Electric metadata exists, prefer it for core fields
        if (meta) {
          return {
            ...blob, // Keep CAS fields (created_ms, mtime_ms, path, etc.)
            filename: meta.filename, // Electric filename (may differ from path)
            mime: meta.mime, // Electric MIME (more reliable)
            size: meta.size, // Electric size (authoritative)
            // Add Electric metadata flag
            hasElectricMetadata: true,
          };
        }

        // No Electric metadata - use CAS data as-is
        return {
          ...blob,
          hasElectricMetadata: false,
        };
      });

      return unified;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
