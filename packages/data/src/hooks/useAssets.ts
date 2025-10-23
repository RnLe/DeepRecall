/**
 * React hooks for Assets using Two-Layer Architecture
 * - Read: Merged data (synced + local) for instant feedback
 * - Write: Local layer (optimistic) with background sync
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Asset } from "@deeprecall/core";
import * as assetsElectric from "../repos/assets.electric";
import * as assetsLocal from "../repos/assets.local";
import * as assetsMerged from "../repos/assets.merged";
import * as assetsCleanup from "../repos/assets.cleanup";
import { db } from "../db";
import { useEffect } from "react";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sync Electric data to Dexie assets table
 * Replaces entire table to ensure deletions are reflected
 *
 * CRITICAL: Must handle empty arrays to clear stale data
 */
async function syncElectricToDexie(electricData: Asset[]): Promise<void> {
  await db.transaction("rw", db.assets, async () => {
    // Get current IDs in Dexie
    const currentIds = new Set(await db.assets.toCollection().primaryKeys());

    // Get IDs from Electric
    const electricIds = new Set(electricData.map((a) => a.id));

    // Find IDs to delete (in Dexie but not in Electric)
    const idsToDelete = Array.from(currentIds).filter(
      (id) => !electricIds.has(id)
    );

    // Delete stale records
    if (idsToDelete.length > 0) {
      await db.assets.bulkDelete(idsToDelete);
      console.log(
        `[Electric→Dexie] Deleted ${idsToDelete.length} stale asset(s)`
      );
    }

    // Add/update records from Electric
    if (electricData.length > 0) {
      await db.assets.bulkPut(electricData);
      console.log(`[Electric→Dexie] Synced ${electricData.length} asset(s)`);
    }

    // Log final state
    if (idsToDelete.length === 0 && electricData.length === 0) {
      console.log(`[Electric→Dexie] Assets table cleared (0 rows)`);
    }
  });
}

// ============================================================================
// Query Hooks (Merged Layer: Synced + Local)
// ============================================================================

// ============================================================================
// Query Hooks (Merged Layer: Synced + Local)
// ============================================================================

/**
 * Hook to get all assets (merged: synced + pending local changes)
 * Returns instant feedback with _local metadata for sync status
 * Auto-cleanup when Electric confirms sync
 */
export function useAssets() {
  const electricResult = assetsElectric.useAssets();

  // Sync Electric data to Dexie assets table (for merge layer)
  // CRITICAL: Must sync even when empty to clear stale data
  useEffect(() => {
    if (electricResult.data !== undefined) {
      syncElectricToDexie(electricResult.data).catch((error) => {
        if (error.name === "DatabaseClosedError") return;
        console.error(
          "[useAssets] Failed to sync Electric data to Dexie:",
          error
        );
      });
    }
  }, [electricResult.data]);

  // Query merged data from Dexie
  const mergedQuery = useQuery({
    queryKey: ["assets", "merged"],
    queryFn: async () => {
      return assetsMerged.getAllMergedAssets();
    },
    staleTime: 0, // Always check for local changes
    initialData: [], // Start with empty array to prevent loading state
  });

  // Auto-cleanup and refresh when Electric data changes (synced)
  useEffect(() => {
    if (electricResult.data) {
      assetsCleanup.cleanupSyncedAssets(electricResult.data).then(() => {
        mergedQuery.refetch();
      });
    }
  }, [electricResult.data]);

  return {
    ...mergedQuery,
    // Only show loading if merged query is loading (not Electric)
    // This allows instant feedback from Dexie cache
    isLoading: mergedQuery.isLoading,
  };
}

/**
 * Hook to get a single asset by ID (merged)
 */
export function useAsset(id: string | undefined) {
  const electricResult = assetsElectric.useAsset(id);

  const mergedQuery = useQuery({
    queryKey: ["assets", "merged", id],
    queryFn: async () => {
      if (!id) return undefined;
      return assetsMerged.getMergedAsset(id);
    },
    enabled: !!id,
    staleTime: 0,
  });

  useEffect(() => {
    if (electricResult.data && id) {
      mergedQuery.refetch();
    }
  }, [electricResult.data, id]);

  return mergedQuery;
}

/**
 * Hook to get assets by work ID (merged)
 */
export function useAssetsByWork(workId: string | undefined) {
  const electricResult = workId
    ? assetsElectric.useAssetsByWork(workId)
    : { data: [], isLoading: false, error: null, syncStatus: "ready" as const };

  const mergedQuery = useQuery({
    queryKey: ["assets", "merged", "work", workId],
    queryFn: async () => {
      if (!workId) return [];
      return assetsMerged.getMergedAssetsByWork(workId);
    },
    enabled: !!workId,
    staleTime: 0,
  });

  useEffect(() => {
    if (electricResult.data && workId) {
      mergedQuery.refetch();
    }
  }, [electricResult.data, workId]);

  return {
    ...mergedQuery,
    isLoading: electricResult.isLoading || mergedQuery.isLoading,
  };
}

/**
 * Hook to get asset by hash (merged)
 */
export function useAssetByHash(sha256: string | undefined) {
  const electricResult = sha256
    ? assetsElectric.useAssetByHash(sha256)
    : {
        data: undefined,
        isLoading: false,
        error: null,
        syncStatus: "ready" as const,
      };

  const mergedQuery = useQuery({
    queryKey: ["assets", "merged", "hash", sha256],
    queryFn: async () => {
      if (!sha256) return undefined;
      return assetsMerged.getMergedAssetByHash(sha256);
    },
    enabled: !!sha256,
    staleTime: 0,
  });

  useEffect(() => {
    if (electricResult.data && sha256) {
      mergedQuery.refetch();
    }
  }, [electricResult.data, sha256]);

  return mergedQuery;
}

// ============================================================================
// Mutation Hooks (Local Layer: Optimistic Writes)
// ============================================================================

// ============================================================================
// Mutation Hooks (Local Layer: Optimistic Writes)
// ============================================================================

/**
 * Hook to create a new asset (instant local write)
 * Writes to local Dexie immediately, syncs in background
 */
export function useCreateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Omit<Asset, "id" | "kind" | "createdAt" | "updatedAt">
    ) => {
      return assetsLocal.createAssetLocal(data);
    },
    onSuccess: (newAsset: Asset) => {
      console.log(
        `✅ [useCreateAsset] Created asset ${newAsset.id} (pending sync)`
      );
      // Invalidate merged queries to show new asset immediately
      queryClient.invalidateQueries({ queryKey: ["assets", "merged"] });
      if (newAsset.workId) {
        queryClient.invalidateQueries({
          queryKey: ["assets", "merged", "work", newAsset.workId],
        });
      }
    },
    onError: (error: Error) => {
      console.error("❌ [useCreateAsset] Failed to create asset:", error);
    },
  });
}

/**
 * Hook to update an asset (instant local write)
 */
export function useUpdateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Asset, "id" | "kind" | "createdAt">>;
    }) => {
      await assetsLocal.updateAssetLocal(id, updates);
      return { id, updates };
    },
    onSuccess: ({ id }: { id: string; updates: Partial<Asset> }) => {
      console.log(`✅ [useUpdateAsset] Updated asset ${id} (pending sync)`);
      // Invalidate merged queries
      queryClient.invalidateQueries({ queryKey: ["assets", "merged"] });
    },
    onError: (error: Error) => {
      console.error("❌ [useUpdateAsset] Failed to update asset:", error);
    },
  });
}

/**
 * Hook to delete an asset (instant local write)
 */
export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await assetsLocal.deleteAssetLocal(id);
      return id;
    },
    onSuccess: (id: string) => {
      console.log(`✅ [useDeleteAsset] Deleted asset ${id} (pending sync)`);
      // Invalidate merged queries to remove immediately
      queryClient.invalidateQueries({ queryKey: ["assets", "merged"] });
    },
    onError: (error: Error) => {
      console.error("❌ [useDeleteAsset] Failed to delete asset:", error);
    },
  });
}
