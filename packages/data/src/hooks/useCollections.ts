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
// Query Hooks (Merged Layer: Synced + Local)
// ============================================================================

/**
 * Hook to get all collections (merged: synced + pending local changes)
 * Returns instant feedback with _local metadata for sync status
 * Auto-cleanup when Electric confirms sync
 */
export function useCollections() {
  const electricResult = collectionsElectric.useCollections();

  // Sync Electric data to Dexie collections table (for merge layer)
  // CRITICAL: Must sync even when empty to clear stale data
  useEffect(() => {
    if (electricResult.data !== undefined) {
      syncElectricToDexie(electricResult.data).catch((error) => {
        console.error(
          "[useCollections] Failed to sync Electric data to Dexie:",
          error
        );
      });
    }
  }, [electricResult.data]);

  // Query merged data from Dexie
  const mergedQuery = useQuery({
    queryKey: ["collections", "merged"],
    queryFn: async () => {
      return collectionsMerged.getAllMergedCollections();
    },
    staleTime: 0, // Always check for local changes
  });

  // Auto-cleanup and refresh when Electric data changes (synced)
  useEffect(() => {
    if (electricResult.data) {
      collectionsCleanup
        .cleanupSyncedCollections(electricResult.data)
        .then(() => {
          mergedQuery.refetch();
        });
    }
  }, [electricResult.data]);

  return {
    ...mergedQuery,
    isLoading: electricResult.isLoading || mergedQuery.isLoading,
  };
}

/**
 * Hook to get a single collection by ID (merged)
 */
export function useCollection(id: string | undefined) {
  const electricResult = collectionsElectric.useCollection(id);

  const mergedQuery = useQuery({
    queryKey: ["collections", "merged", id],
    queryFn: async () => {
      if (!id) return undefined;
      return collectionsMerged.getMergedCollection(id);
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
 * Hook to get public collections (merged)
 */
export function usePublicCollections() {
  const electricResult = collectionsElectric.usePublicCollections();

  const mergedQuery = useQuery({
    queryKey: ["collections", "merged", "public"],
    queryFn: async () => {
      return collectionsMerged.getMergedPublicCollections();
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (electricResult.data) {
      mergedQuery.refetch();
    }
  }, [electricResult.data]);

  return mergedQuery;
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
