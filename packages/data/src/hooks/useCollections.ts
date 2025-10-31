/**
 * React hooks for Collections using Two-Layer Architecture
 * - Read: Merged data (synced + local) for instant feedback
 * - Write: Local layer (optimistic) with background sync
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Collection } from "@deeprecall/core";
import * as collectionsElectric from "../repos/collections.electric";
import * as collectionsLocal from "../repos/collections.local";
import * as collectionsMerged from "../repos/collections.merged";
import * as collectionsCleanup from "../repos/collections.cleanup";
import { db } from "../db";
import { useEffect } from "react";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sync Electric data to Dexie collections table
 * Replaces entire table to ensure deletions are reflected
 *
 * CRITICAL: Must handle empty arrays to clear stale data
 */
async function syncElectricToDexie(electricData: Collection[]): Promise<void> {
  await db.transaction("rw", db.collections, async () => {
    // Get current IDs in Dexie
    const currentIds = new Set(
      await db.collections.toCollection().primaryKeys()
    );

    // Get IDs from Electric
    const electricIds = new Set(electricData.map((c) => c.id));

    // Find IDs to delete (in Dexie but not in Electric)
    const idsToDelete = Array.from(currentIds).filter(
      (id) => !electricIds.has(id)
    );

    // Delete stale records
    if (idsToDelete.length > 0) {
      await db.collections.bulkDelete(idsToDelete);
      console.log(
        `[Electric→Dexie] Deleted ${idsToDelete.length} stale collection(s)`
      );
    }

    // Add/update records from Electric
    if (electricData.length > 0) {
      await db.collections.bulkPut(electricData);
      console.log(
        `[Electric→Dexie] Synced ${electricData.length} collection(s)`
      );
    }

    // Log final state
    if (idsToDelete.length === 0 && electricData.length === 0) {
      console.log(`[Electric→Dexie] Collections table cleared (0 rows)`);
    }
  });
}

// ============================================================================
// Sync Hook (Internal: Called ONLY by SyncManager)
// ============================================================================

/**
 * Internal sync hook - subscribes to Electric and syncs to Dexie
 * MUST be called exactly once by SyncManager to avoid race conditions
 * DO NOT call from components - use useCollections() instead
 */
export function useCollectionsSync() {
  const electricResult = collectionsElectric.useCollections();
  const queryClient = useQueryClient();

  // Sync Electric data to Dexie
  useEffect(() => {
    if (
      !electricResult.isLoading &&
      electricResult.data !== undefined
      // Note: Sync even with stale cache data - having stale data is better than no data
    ) {
      syncElectricToDexie(electricResult.data)
        .then(() => {
          // Invalidate all collections queries to trigger cross-device updates
          queryClient.invalidateQueries({ queryKey: ["collections"] });
        })
        .catch((error) => {
          console.error(
            "[useCollectionsSync] Failed to sync Electric data to Dexie:",
            error
          );
        });
    }
  }, [electricResult.data, electricResult.isFreshData, queryClient]);

  // Cleanup synced collections
  useEffect(() => {
    if (
      !electricResult.isLoading &&
      electricResult.data
      // Cleanup even with stale data - if Electric has these IDs, local changes should be removed
    ) {
      collectionsCleanup.cleanupSyncedCollections(electricResult.data);
    }
  }, [
    electricResult.isLoading,
    electricResult.data,
    electricResult.isFreshData,
  ]);

  return null;
}

// ============================================================================
// Query Hooks (Merged Layer: Synced + Local)
// ============================================================================

/**
 * Hook to get all collections (merged: synced + pending local changes)
 * Read-only - queries Dexie merged view without side effects
 */
export function useCollections() {
  return useQuery({
    queryKey: ["collections", "merged"],
    queryFn: async () => {
      return collectionsMerged.getAllMergedCollections();
    },
    staleTime: 0,
    placeholderData: [], // Show empty array while loading (prevents loading state)
  });
}

/**
 * Hook to get a single collection by ID (merged)
 * Read-only - queries Dexie merged view without side effects
 */
export function useCollection(id: string | undefined) {
  return useQuery({
    queryKey: ["collections", "merged", id],
    queryFn: async () => {
      if (!id) return undefined;
      return collectionsMerged.getMergedCollection(id);
    },
    enabled: !!id,
    staleTime: 0,
  });
}

/**
 * Hook to get public collections (merged)
 * Read-only - queries Dexie merged view without side effects
 */
export function usePublicCollections() {
  return useQuery({
    queryKey: ["collections", "merged", "public"],
    queryFn: async () => {
      return collectionsMerged.getMergedPublicCollections();
    },
    staleTime: 0,
  });
}

// ============================================================================
// Mutation Hooks (Local Layer: Optimistic Writes)
// ============================================================================

/**
 * Hook to create a new collection (instant local write)
 * Writes to local Dexie immediately, syncs in background
 */
export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Omit<Collection, "id" | "kind" | "createdAt" | "updatedAt">
    ) => {
      return collectionsLocal.createCollectionLocal(data);
    },
    onSuccess: (newCollection: Collection) => {
      console.log(
        `✅ [useCreateCollection] Created collection ${newCollection.id} (pending sync)`
      );
      // Invalidate merged queries to show new collection immediately
      queryClient.invalidateQueries({ queryKey: ["collections", "merged"] });
    },
    onError: (error: Error) => {
      console.error(
        "❌ [useCreateCollection] Failed to create collection:",
        error
      );
    },
  });
}

/**
 * Hook to update a collection (instant local write)
 */
export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Collection, "id" | "kind" | "createdAt">>;
    }) => {
      await collectionsLocal.updateCollectionLocal(id, updates);
      return { id, updates };
    },
    onSuccess: ({ id }: { id: string; updates: Partial<Collection> }) => {
      console.log(
        `✅ [useUpdateCollection] Updated collection ${id} (pending sync)`
      );
      // Invalidate merged queries
      queryClient.invalidateQueries({ queryKey: ["collections", "merged"] });
    },
    onError: (error: Error) => {
      console.error(
        "❌ [useUpdateCollection] Failed to update collection:",
        error
      );
    },
  });
}

/**
 * Hook to delete a collection (instant local write)
 */
export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await collectionsLocal.deleteCollectionLocal(id);
      return id;
    },
    onSuccess: (id: string) => {
      console.log(
        `✅ [useDeleteCollection] Deleted collection ${id} (pending sync)`
      );
      // Invalidate merged queries to remove immediately
      queryClient.invalidateQueries({ queryKey: ["collections", "merged"] });
    },
    onError: (error: Error) => {
      console.error(
        "❌ [useDeleteCollection] Failed to delete collection:",
        error
      );
    },
  });
}
