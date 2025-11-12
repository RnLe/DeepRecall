/**
 * React hooks for Assets using Two-Layer Architecture
 * - Read: Merged data (synced + local) for instant feedback
 * - Write: Local layer (optimistic) with background sync
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Asset } from "@deeprecall/core";
import * as assetsElectric from "../repos/assets.electric";
import * as assetsLocal from "../repos/assets.local";
import * as assetsMerged from "../repos/assets.merged";
import * as assetsCleanup from "../repos/assets.cleanup";
import { db } from "../db";
import { useEffect } from "react";
import { logger } from "@deeprecall/telemetry";
import { useEdges } from "./useEdges";

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
      logger.info("sync.electric", "Deleted stale assets from Dexie", {
        count: idsToDelete.length,
        ids: idsToDelete,
      });
    }

    // Add/update records from Electric
    if (electricData.length > 0) {
      await db.assets.bulkPut(electricData);
      logger.info("sync.electric", "Synced assets from Electric to Dexie", {
        count: electricData.length,
      });
    }

    // Log final state
    if (idsToDelete.length === 0 && electricData.length === 0) {
      logger.info("sync.electric", "Assets table cleared", { count: 0 });
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
 * DO NOT call this from components! Use useAssets() instead.
 * @param userId - Filter assets by owner_id (multi-tenant isolation)
 */
export function useAssetsSync(userId?: string) {
  const electricResult = assetsElectric.useAssets(userId);
  const queryClient = useQueryClient();

  // Sync Electric data to Dexie assets table (for merge layer)
  useEffect(() => {
    if (
      !electricResult.isLoading &&
      electricResult.data !== undefined
      // Note: Sync even with stale cache data - having stale data is better than no data
    ) {
      syncElectricToDexie(electricResult.data)
        .then(() => {
          // Invalidate all assets queries to trigger re-render
          queryClient.invalidateQueries({ queryKey: ["assets"] });
        })
        .catch((error) => {
          if (error.name === "DatabaseClosedError") return;
          logger.error("sync.electric", "Failed to sync assets to Dexie", {
            error: error.message,
          });
        });
    }
  }, [electricResult.data, electricResult.isFreshData, queryClient]);

  // Run cleanup when Electric confirms sync
  useEffect(() => {
    if (
      !electricResult.isLoading &&
      electricResult.data &&
      electricResult.isFreshData
    ) {
      assetsCleanup.cleanupSyncedAssets(electricResult.data).catch((error) => {
        if (error.name === "DatabaseClosedError") return;
        logger.error("db.local", "Failed to cleanup assets", {
          error: error.message,
        });
      });
    }
  }, [
    electricResult.isLoading,
    electricResult.data,
    electricResult.isFreshData,
  ]);

  return null;
}

// ============================================================================
// Query Hooks (Public - Called by components)
// ============================================================================

/**
 * Hook to get all assets (merged: synced + pending local changes)
 * Returns instant feedback with _local metadata for sync status
 *
 * This is a READ-ONLY hook with no side effects.
 * Sync is handled by useAssetsSync() in SyncManager.
 */
export function useAssets() {
  return useQuery({
    queryKey: ["assets", "merged"],
    queryFn: async () => {
      return assetsMerged.getAllMergedAssets();
    },
    staleTime: 0, // Always check for local changes
    placeholderData: [], // Show empty array while loading (prevents loading state)
  });
}

/**
 * Hook to get a single asset by ID (merged)
 * READ-ONLY: No sync side effects (handled by useAssetsSync)
 */
export function useAsset(id: string | undefined) {
  return useQuery({
    queryKey: ["assets", "merged", id],
    queryFn: async () => {
      if (!id) return undefined;
      return assetsMerged.getMergedAsset(id);
    },
    enabled: !!id,
    staleTime: 0,
  });
}

/**
 * Hook to get assets by work ID (merged)
 * READ-ONLY: No sync side effects (handled by useAssetsSync)
 */
export function useAssetsByWork(workId: string | undefined) {
  return useQuery({
    queryKey: ["assets", "merged", "work", workId],
    queryFn: async () => {
      if (!workId) return [];
      return assetsMerged.getMergedAssetsByWork(workId);
    },
    enabled: !!workId,
    staleTime: 0,
  });
}

/**
 * Hook to get asset by hash (merged)
 * READ-ONLY: No sync side effects (handled by useAssetsSync)
 */
export function useAssetByHash(sha256: string | undefined) {
  return useQuery({
    queryKey: ["assets", "merged", "hash", sha256],
    queryFn: async () => {
      if (!sha256) return undefined;
      return assetsMerged.getMergedAssetByHash(sha256);
    },
    enabled: !!sha256,
    staleTime: 0,
  });
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
      logger.info("db.local", "Created asset locally (pending sync)", {
        assetId: newAsset.id,
        workId: newAsset.workId,
      });
      // Invalidate merged queries to show new asset immediately
      queryClient.invalidateQueries({ queryKey: ["assets", "merged"] });
      if (newAsset.workId) {
        queryClient.invalidateQueries({
          queryKey: ["assets", "merged", "work", newAsset.workId],
        });
      }
    },
    onError: (error: Error) => {
      logger.error("db.local", "Failed to create asset", {
        error: error.message,
      });
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
      logger.info("db.local", "Updated asset locally (pending sync)", {
        assetId: id,
      });
      // Invalidate merged queries
      queryClient.invalidateQueries({ queryKey: ["assets", "merged"] });
    },
    onError: (error: Error) => {
      logger.error("db.local", "Failed to update asset", {
        error: error.message,
      });
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
      logger.info("db.local", "Deleted asset locally (pending sync)", {
        assetId: id,
      });
      // Invalidate merged queries to remove immediately
      queryClient.invalidateQueries({ queryKey: ["assets", "merged"] });
    },
    onError: (error: Error) => {
      logger.error("db.local", "Failed to delete asset", {
        error: error.message,
      });
    },
  });
}

// ============================================================================
// Additional Query Hooks (Asset-Specific)
// ============================================================================

/**
 * Hook to get unlinked standalone assets - "Unlinked Assets"
 *
 * MENTAL MODEL: Assets that exist but are not connected to anything:
 * - No workId (not part of any Work)
 * - No edges with relation="contains" (not in any Activity/Collection)
 *
 * These Assets represent "data" that can be moved around and linked.
 * They reference blobs (raw files) via sha256, but have their own lifecycle.
 */
export function useUnlinkedAssets() {
  const { data: allAssets = [] } = useAssets();
  const { data: allEdges = [] } = useEdges();

  return useMemo(() => {
    // Get all standalone assets (no workId)
    const standaloneAssets = allAssets.filter((asset) => !asset.workId);

    // Get asset IDs that are linked via "contains" relation
    // (Activities and Collections use "contains" edges to link to Assets)
    const assetIds = new Set(allAssets.map((a) => a.id));
    const linkedAssetIds = new Set(
      allEdges
        .filter(
          (edge) => edge.relation === "contains" && assetIds.has(edge.toId)
        )
        .map((edge) => edge.toId)
    );

    // Filter to only assets that are NOT in any edges
    // Use a Map to deduplicate by asset.id to prevent duplicates
    const unlinkedMap = new Map<string, Asset>();
    for (const asset of standaloneAssets) {
      if (!linkedAssetIds.has(asset.id)) {
        unlinkedMap.set(asset.id, asset);
      }
    }

    return Array.from(unlinkedMap.values());
  }, [allAssets, allEdges]);
}

/**
 * Hook to get duplicate assets (multiple assets with same hash)
 * Returns a Map of sha256 -> Array<Asset> for all hashes with duplicates
 */
export function useDuplicateAssets() {
  const { data: assets = [] } = useAssets();

  return useQuery({
    queryKey: ["duplicateAssets", assets.length],
    queryFn: async (): Promise<Map<string, Asset[]>> => {
      const hashToAssets = new Map<string, Asset[]>();

      for (const asset of assets) {
        if (!asset.sha256) continue;
        const existing = hashToAssets.get(asset.sha256) || [];
        existing.push(asset);
        hashToAssets.set(asset.sha256, existing);
      }

      // Filter to only hashes with multiple assets
      const duplicates = new Map<string, Asset[]>();
      for (const [hash, assetList] of hashToAssets.entries()) {
        if (assetList.length > 1) {
          duplicates.set(hash, assetList);
        }
      }

      return duplicates;
    },
    staleTime: 1000 * 60 * 5,
    initialData: new Map(),
  });
}
