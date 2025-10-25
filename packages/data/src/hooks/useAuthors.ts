/**
 * React hooks for Authors using Two-Layer Architecture
 * - Read: Merged data (synced + local) for instant feedback
 * - Write: Local layer (optimistic) with background sync
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Author } from "@deeprecall/core";
import * as authorsElectric from "../repos/authors.electric";
import * as authorsLocal from "../repos/authors.local";
import * as authorsMerged from "../repos/authors.merged";
import * as authorsCleanup from "../repos/authors.cleanup";
import { db } from "../db";
import { useEffect } from "react";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sync Electric data to Dexie authors table
 * Replaces entire table to ensure deletions are reflected
 *
 * CRITICAL: Must handle empty arrays to clear stale data
 */
async function syncElectricToDexie(electricData: Author[]): Promise<void> {
  await db.transaction("rw", db.authors, async () => {
    // Get current IDs in Dexie
    const currentIds = new Set(await db.authors.toCollection().primaryKeys());

    // Get IDs from Electric
    const electricIds = new Set(electricData.map((a) => a.id));

    // Find IDs to delete (in Dexie but not in Electric)
    const idsToDelete = Array.from(currentIds).filter(
      (id) => !electricIds.has(id)
    );

    // Delete stale records
    if (idsToDelete.length > 0) {
      await db.authors.bulkDelete(idsToDelete);
      console.log(
        `[Electric→Dexie] Deleted ${idsToDelete.length} stale author(s)`
      );
    }

    // Add/update records from Electric
    if (electricData.length > 0) {
      await db.authors.bulkPut(electricData);
      console.log(`[Electric→Dexie] Synced ${electricData.length} author(s)`);
    }

    // Log final state
    if (idsToDelete.length === 0 && electricData.length === 0) {
      console.log(`[Electric→Dexie] Authors table cleared (0 rows)`);
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
 * DO NOT call this from components! Use useAuthors() instead.
 */
export function useAuthorsSync() {
  const electricResult = authorsElectric.useAuthors();

  // Sync Electric data to Dexie authors table (for merge layer)
  useEffect(() => {
    if (
      !electricResult.isLoading &&
      electricResult.data !== undefined &&
      electricResult.isFreshData
    ) {
      syncElectricToDexie(electricResult.data).catch((error) => {
        if (error.name === "DatabaseClosedError") return;
        console.error(
          "[useAuthorsSync] Failed to sync Electric data to Dexie:",
          error
        );
      });
    }
  }, [electricResult.data, electricResult.isFreshData]);

  // Run cleanup when Electric confirms sync
  useEffect(() => {
    if (
      !electricResult.isLoading &&
      electricResult.data &&
      electricResult.isFreshData
    ) {
      authorsCleanup
        .cleanupSyncedAuthors(electricResult.data)
        .catch((error) => {
          if (error.name === "DatabaseClosedError") return;
          console.error("[useAuthorsSync] Failed to cleanup:", error);
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
 * Hook to get all authors (merged: synced + pending local changes)
 * Returns instant feedback with _local metadata for sync status
 *
 * This is a READ-ONLY hook with no side effects.
 * Sync is handled by useAuthorsSync() in SyncManager.
 */
export function useAuthors() {
  return useQuery({
    queryKey: ["authors", "merged"],
    queryFn: async () => {
      return authorsMerged.getAllMergedAuthors();
    },
    staleTime: 0, // Always check for local changes
    placeholderData: [], // Show empty array while loading (prevents loading state)
  });
}

/**
 * Hook to get a single author by ID (merged)
 * READ-ONLY: No sync side effects (handled by useAuthorsSync)
 */
export function useAuthor(id: string | undefined) {
  return useQuery({
    queryKey: ["authors", "merged", id],
    queryFn: async () => {
      if (!id) return undefined;
      return authorsMerged.getMergedAuthor(id);
    },
    enabled: !!id,
    staleTime: 0,
  });
}

/**
 * Hook to get multiple authors by IDs (merged)
 * READ-ONLY: No sync side effects (handled by useAuthorsSync)
 */
export function useAuthorsByIds(ids: string[]) {
  return useQuery({
    queryKey: ["authors", "merged", "ids", ids],
    queryFn: async () => {
      return authorsMerged.getMergedAuthorsByIds(ids);
    },
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
 * Hook to create a new author (instant local write)
 * Writes to local Dexie immediately, syncs in background
 */
export function useCreateAuthor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Omit<Author, "id" | "kind" | "createdAt" | "updatedAt">
    ) => {
      return authorsLocal.createAuthorLocal(data);
    },
    onSuccess: (newAuthor: Author) => {
      console.log(
        `✅ [useCreateAuthor] Created author ${newAuthor.id} (pending sync)`
      );
      // Invalidate merged queries to show new author immediately
      queryClient.invalidateQueries({ queryKey: ["authors", "merged"] });
    },
    onError: (error: Error) => {
      console.error("❌ [useCreateAuthor] Failed to create author:", error);
    },
  });
}

/**
 * Hook to update an existing author (instant local write)
 */
export function useUpdateAuthor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Author, "id" | "kind" | "createdAt">>;
    }) => {
      await authorsLocal.updateAuthorLocal(id, updates);
      return { id, updates };
    },
    onSuccess: ({ id }: { id: string; updates: Partial<Author> }) => {
      console.log(`✅ [useUpdateAuthor] Updated author ${id} (pending sync)`);
      // Invalidate merged queries
      queryClient.invalidateQueries({ queryKey: ["authors", "merged"] });
    },
    onError: (error: Error) => {
      console.error("❌ [useUpdateAuthor] Failed to update author:", error);
    },
  });
}

/**
 * Hook to delete an author (instant local write)
 */
export function useDeleteAuthor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await authorsLocal.deleteAuthorLocal(id);
      return id;
    },
    onSuccess: (id: string) => {
      console.log(`✅ [useDeleteAuthor] Deleted author ${id} (pending sync)`);
      // Invalidate merged queries to remove immediately
      queryClient.invalidateQueries({ queryKey: ["authors", "merged"] });
    },
    onError: (error: Error) => {
      console.error("❌ [useDeleteAuthor] Failed to delete author:", error);
    },
  });
}

/**
 * Hook to find or create an author
 * Searches by name first, creates if not found
 */
export function useFindOrCreateAuthor() {
  const { data: allAuthors = [] } = useAuthors();
  const createAuthor = useCreateAuthor();

  return useMutation({
    mutationFn: async (data: {
      firstName: string;
      lastName: string;
      middleName?: string;
      orcid?: string;
    }) => {
      // Try to find existing author by name
      const existing = allAuthors.find(
        (a) =>
          a.firstName.toLowerCase() === data.firstName.toLowerCase() &&
          a.lastName.toLowerCase() === data.lastName.toLowerCase()
      );

      if (existing) {
        console.log(
          `[useFindOrCreateAuthor] Found existing author: ${existing.id}`
        );
        return existing;
      }

      // Create new author
      console.log(
        `[useFindOrCreateAuthor] Creating new author: ${data.firstName} ${data.lastName}`
      );
      return createAuthor.mutateAsync({
        ...data,
        affiliation: undefined,
      });
    },
  });
}
