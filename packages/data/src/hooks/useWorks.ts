/**
 * React hooks for Works using Two-Layer Architecture
 * - Read: Merged data (synced + local) for instant feedback
 * - Write: Local layer (optimistic) with background sync
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Work, WorkExtended } from "@deeprecall/core";
import * as worksElectric from "../repos/works.electric";
import * as worksLocal from "../repos/works.local";
import * as worksMerged from "../repos/works.merged";
import * as worksCleanup from "../repos/works.cleanup";
import { db } from "../db";
import { useEffect } from "react";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sync Electric data to Dexie works table
 * Replaces entire table to ensure deletions are reflected
 *
 * CRITICAL: Must handle empty arrays to clear stale data
 */
async function syncElectricToDexie(electricData: Work[]): Promise<void> {
  await db.transaction("rw", db.works, async () => {
    // Get current IDs in Dexie
    const currentIds = new Set(await db.works.toCollection().primaryKeys());

    // Get IDs from Electric
    const electricIds = new Set(electricData.map((w) => w.id));

    // Find IDs to delete (in Dexie but not in Electric)
    const idsToDelete = Array.from(currentIds).filter(
      (id) => !electricIds.has(id)
    );

    // Delete stale records
    if (idsToDelete.length > 0) {
      await db.works.bulkDelete(idsToDelete);
      console.log(
        `[Electric→Dexie] Deleted ${idsToDelete.length} stale work(s)`
      );
    }

    // Add/update records from Electric
    if (electricData.length > 0) {
      await db.works.bulkPut(electricData);
      console.log(`[Electric→Dexie] Synced ${electricData.length} work(s)`);
    }

    // Log final state
    if (idsToDelete.length === 0 && electricData.length === 0) {
      console.log(`[Electric→Dexie] Works table cleared (0 rows)`);
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
 * Hook to get all works (merged: synced + pending local changes)
 * Returns instant feedback with _local metadata for sync status
 * Auto-cleanup when Electric confirms sync
 */
export function useWorks() {
  const electricResult = worksElectric.useWorks();

  // Sync Electric data to Dexie works table (for merge layer)
  // CRITICAL: Only sync after initial load to preserve cached data on page reload
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data !== undefined) {
      // Replace entire Dexie works table with Electric data
      // This ensures deletions are properly reflected
      syncElectricToDexie(electricResult.data).catch((error) => {
        // Ignore DatabaseClosedError (happens during db.delete())
        if (error.name === "DatabaseClosedError") {
          return;
        }
        console.error(
          "[useWorks] Failed to sync Electric data to Dexie:",
          error
        );
      });
    }
  }, [electricResult.isLoading, electricResult.data]);

  // Query merged data from Dexie
  const mergedQuery = useQuery({
    queryKey: ["works", "merged"],
    queryFn: async () => {
      return worksMerged.getAllMergedWorks();
    },
    staleTime: 0, // Always check for local changes
    placeholderData: [], // Show empty array while loading (prevents loading state)
  });

  // Auto-cleanup and refresh when Electric data changes (synced)
  // CRITICAL: Check isLoading to avoid cleanup on initial undefined state
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data) {
      // Cleanup confirmed syncs
      worksCleanup.cleanupSyncedWorks(electricResult.data).then(() => {
        // Refresh merged view after cleanup
        mergedQuery.refetch();
      });
    }
  }, [electricResult.isLoading, electricResult.data]);

  return {
    ...mergedQuery,
    // Only show loading if merged query is loading (not Electric)
    // This allows instant feedback from Dexie cache
    isLoading: mergedQuery.isLoading,
  };
}

/**
 * Hook to get a single work by ID (merged)
 */
export function useWork(id: string | undefined) {
  const electricResult = worksElectric.useWork(id);

  const mergedQuery = useQuery({
    queryKey: ["works", "merged", id],
    queryFn: async () => {
      if (!id) return undefined;
      return worksMerged.getMergedWork(id);
    },
    enabled: !!id,
    staleTime: 0,
  });

  // CRITICAL: Check isLoading to prevent refetch during initial load
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data && id) {
      mergedQuery.refetch();
    }
  }, [electricResult.isLoading, electricResult.data, id]);

  return mergedQuery;
}

/**
 * Hook to get works by type (merged)
 */
export function useWorksByType(workType: string) {
  const electricResult = worksElectric.useWorksByType(workType);

  const mergedQuery = useQuery({
    queryKey: ["works", "merged", "type", workType],
    queryFn: async () => {
      return worksMerged.getMergedWorksByType(workType);
    },
    staleTime: 0,
  });

  // CRITICAL: Check isLoading to prevent refetch during initial load
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data) {
      mergedQuery.refetch();
    }
  }, [electricResult.isLoading, electricResult.data]);

  return mergedQuery;
}

/**
 * Hook to get favorite works (merged)
 */
export function useFavoriteWorks() {
  const electricResult = worksElectric.useFavoriteWorks();

  const mergedQuery = useQuery({
    queryKey: ["works", "merged", "favorites"],
    queryFn: async () => {
      return worksMerged.getMergedFavoriteWorks();
    },
    staleTime: 0,
  });

  // CRITICAL: Check isLoading to prevent refetch during initial load
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data) {
      mergedQuery.refetch();
    }
  }, [electricResult.isLoading, electricResult.data]);

  return mergedQuery;
}

/**
 * Hook to search works by title (client-side filtering on merged data)
 */
export function useSearchWorks(query: string) {
  const mergedQuery = useQuery({
    queryKey: ["works", "merged", "search", query],
    queryFn: async () => {
      return worksMerged.searchMergedWorksByTitle(query);
    },
    staleTime: 0,
  });

  return mergedQuery;
}

// ============================================================================
// Mutation Hooks (Local Layer: Optimistic Writes)
// ============================================================================

// ============================================================================
// Mutation Hooks (Local Layer: Optimistic Writes)
// ============================================================================

/**
 * Hook to create a new work (instant local write)
 * Writes to local Dexie immediately, syncs in background
 */
export function useCreateWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Omit<Work, "id" | "kind" | "createdAt" | "updatedAt">
    ) => {
      return worksLocal.createWorkLocal(data);
    },
    onSuccess: (newWork: Work) => {
      console.log(
        `✅ [useCreateWork] Created work ${newWork.id} (pending sync)`
      );
      // Invalidate merged queries to show new work immediately
      queryClient.invalidateQueries({ queryKey: ["works", "merged"] });
    },
    onError: (error: Error) => {
      console.error("❌ [useCreateWork] Failed to create work:", error);
    },
  });
}

/**
 * Hook to update a work (instant local write)
 */
export function useUpdateWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Work, "id" | "kind" | "createdAt">>;
    }) => {
      await worksLocal.updateWorkLocal(id, updates);
      return { id, updates };
    },
    onSuccess: ({ id }: { id: string; updates: Partial<Work> }) => {
      console.log(`✅ [useUpdateWork] Updated work ${id} (pending sync)`);
      // Invalidate merged queries
      queryClient.invalidateQueries({ queryKey: ["works", "merged"] });
    },
    onError: (error: Error) => {
      console.error("❌ [useUpdateWork] Failed to update work:", error);
    },
  });
}

/**
 * Hook to delete a work (instant local write)
 */
export function useDeleteWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await worksLocal.deleteWorkLocal(id);
      return id;
    },
    onSuccess: (id: string) => {
      console.log(`✅ [useDeleteWork] Deleted work ${id} (pending sync)`);
      // Invalidate merged queries to remove immediately
      queryClient.invalidateQueries({ queryKey: ["works", "merged"] });
    },
    onError: (error: Error) => {
      console.error("❌ [useDeleteWork] Failed to delete work:", error);
    },
  });
}

/**
 * Hook to toggle favorite status (instant local write)
 */
export function useToggleWorkFavorite() {
  const updateWork = useUpdateWork();

  return useMutation({
    mutationFn: async (work: Work) => {
      return updateWork.mutateAsync({
        id: work.id,
        updates: { favorite: !work.favorite },
      });
    },
    onError: (error: Error) => {
      console.error(
        "❌ [useToggleWorkFavorite] Failed to toggle favorite:",
        error
      );
    },
  });
}

/**
 * Hook to create a work with its first asset
 * TEMPORARY: Uses Electric repo directly until Assets are migrated
 * Both work and asset operations are enqueued as separate writes
 */
export function useCreateWorkWithAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      work: Omit<Work, "id" | "createdAt" | "updatedAt">;
      asset?: {
        sha256: string;
        filename: string;
        bytes: number;
        mime: string;
        pageCount?: number;
        role?:
          | "main"
          | "supplement"
          | "slides"
          | "solutions"
          | "data"
          | "notes"
          | "exercises";
        metadata?: Record<string, unknown>;
      };
    }) => {
      // Use Electric repo's implementation (which handles both work and asset)
      // Once Assets are migrated, this will be refactored to use worksLocal + assetsLocal
      return worksElectric.createWorkWithAsset(params);
    },
    onSuccess: ({ work, asset }: { work: any; asset: any }) => {
      console.log(
        `✅ [useCreateWorkWithAsset] Created work ${work.id}${
          asset ? ` with asset ${asset.id}` : ""
        } (pending sync)`
      );

      // Invalidate both works and assets queries
      queryClient.invalidateQueries({ queryKey: ["works", "merged"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
    },
    onError: (error: Error) => {
      console.error(
        "❌ [useCreateWorkWithAsset] Failed to create work with asset:",
        error
      );
    },
  });
}

// ============================================================================
// Extended Queries (Temporary - uses Dexie until Assets migrated)
// ============================================================================

/**
 * TEMPORARY: Hook to get a single work with all assets
 * Uses Dexie for now; will be replaced with Electric joins/shapes
 */
export function useWorkExtended(id: string | undefined) {
  // For now, we need to use Dexie's extended query
  // This will be migrated once Assets are also on Electric
  // TODO: Replace with Electric shape that joins works + assets

  // We can't use hooks conditionally, so we'll need to use React Query
  // for this imperative query pattern
  const queryClient = useQueryClient();

  // Placeholder: This would need to be implemented properly
  // For now, users should use the Dexie-based hook from useLibrary
  throw new Error(
    "useWorkExtended not yet implemented for Electric. Use the Dexie version from @deeprecall/data/hooks/useLibrary until Assets are migrated to Electric."
  );
}

/**
 * TEMPORARY: Hook to get all works with extended data
 * Uses Dexie for now; will be replaced with Electric
 */
export function useWorksExtended() {
  // TODO: Implement once Assets are migrated to Electric
  throw new Error(
    "useWorksExtended not yet implemented for Electric. Use the Dexie version from apps/web/src/hooks/useLibrary until Assets are migrated to Electric."
  );
}
