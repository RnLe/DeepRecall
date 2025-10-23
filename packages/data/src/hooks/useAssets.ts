/**
 * React hooks for Assets using Electric + WriteBuffer
 * Platform-agnostic data access with real-time sync
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Asset } from "@deeprecall/core";
import * as assetsElectric from "../repos/assets.electric";

// ============================================================================
// Query Hooks (Electric-based, live-synced)
// ============================================================================

/**
 * Hook to get all assets (live-synced from Postgres via Electric)
 * Returns: { data, isLoading, error, syncStatus }
 */
export function useAssets() {
  return assetsElectric.useAssets();
}

/**
 * Hook to get a single asset by ID (live-synced)
 */
export function useAsset(id: string | undefined) {
  return assetsElectric.useAsset(id);
}

/**
 * Hook to get assets by work ID (live-synced)
 */
export function useAssetsByWork(workId: string | undefined) {
  if (!workId) {
    return {
      data: [],
      isLoading: false,
      error: null,
      syncStatus: "ready" as const,
    };
  }
  return assetsElectric.useAssetsByWork(workId);
}

/**
 * Hook to get asset by hash (live-synced)
 */
export function useAssetByHash(sha256: string | undefined) {
  if (!sha256) {
    return {
      data: undefined,
      isLoading: false,
      error: null,
      syncStatus: "ready" as const,
    };
  }
  return assetsElectric.useAssetByHash(sha256);
}

// ============================================================================
// Mutation Hooks (WriteBuffer-based, optimistic)
// ============================================================================

/**
 * Hook to create a new asset
 * Writes to buffer immediately, syncs in background
 */
export function useCreateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Asset, "id" | "createdAt" | "updatedAt">) => {
      return assetsElectric.createAsset(data);
    },
    onSuccess: (newAsset: Asset) => {
      console.log(
        `[useCreateAsset] Created asset ${newAsset.id} (queued for sync)`
      );

      // Optimistically invalidate queries (Electric will sync back)
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      if (newAsset.workId) {
        queryClient.invalidateQueries({
          queryKey: ["assets", "work", newAsset.workId],
        });
      }
    },
    onError: (error: Error) => {
      console.error("[useCreateAsset] Failed to create asset:", error);
    },
  });
}

/**
 * Hook to update an asset
 * Writes to buffer immediately, syncs in background
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
      await assetsElectric.updateAsset(id, updates);
      return { id, updates };
    },
    onSuccess: ({ id }: { id: string; updates: Partial<Asset> }) => {
      console.log(`[useUpdateAsset] Updated asset ${id} (queued for sync)`);

      // Optimistically invalidate queries
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset", id] });
    },
    onError: (error: Error) => {
      console.error("[useUpdateAsset] Failed to update asset:", error);
    },
  });
}

/**
 * Hook to delete an asset
 * Writes to buffer immediately, syncs in background
 */
export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await assetsElectric.deleteAsset(id);
      return id;
    },
    onSuccess: (id: string) => {
      console.log(`[useDeleteAsset] Deleted asset ${id} (queued for sync)`);

      // Optimistically invalidate queries
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset", id] });
    },
    onError: (error: Error) => {
      console.error("[useDeleteAsset] Failed to delete asset:", error);
    },
  });
}
