/**
 * React hooks for Strokes using Two-Layer Architecture
 * - Read: Merged data (synced + local) for instant feedback
 * - Write: Local layer (optimistic) with background sync
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Stroke } from "@deeprecall/core";
import * as strokesElectric from "../repos/strokes.electric";
import * as strokesLocal from "../repos/strokes.local";
import * as strokesMerged from "../repos/strokes.merged";
import * as strokesCleanup from "../repos/strokes.cleanup";
import { db } from "../db";
import { useEffect } from "react";

/**
 * Sync Electric data to Dexie strokes table
 */
async function syncElectricToDexie(electricData: Stroke[]): Promise<void> {
  await db.transaction("rw", db.strokes, async () => {
    // Get current IDs in Dexie
    const currentIds = new Set(await db.strokes.toCollection().primaryKeys());

    // Get IDs from Electric
    const electricIds = new Set(electricData.map((s) => s.id));

    // Find IDs to delete (in Dexie but not in Electric)
    const idsToDelete = Array.from(currentIds).filter(
      (id) => !electricIds.has(id)
    );

    // Delete stale records
    if (idsToDelete.length > 0) {
      await db.strokes.bulkDelete(idsToDelete);
      console.log(
        `[Electric→Dexie] Deleted ${idsToDelete.length} stale stroke(s)`
      );
    }

    // Add/update records from Electric
    if (electricData.length > 0) {
      await db.strokes.bulkPut(electricData);
      console.log(`[Electric→Dexie] Synced ${electricData.length} stroke(s)`);
    }

    // Log final state
    if (idsToDelete.length === 0 && electricData.length === 0) {
      console.log(`[Electric→Dexie] Strokes table cleared (0 rows)`);
    }
  });
}

// ============================================================================
// Sync Hooks (Internal - Called by SyncManager only)
// ============================================================================

/**
 * Internal sync hook: Subscribes to Electric and syncs to Dexie
 * CRITICAL: Must only be called ONCE by SyncManager
 *
 * Note: Subscribes to ALL strokes, filtering by board is done on read
 */
export function useStrokesSync() {
  const electricResult = strokesElectric.useStrokes(undefined);
  const queryClient = useQueryClient();

  // Sync Electric data to Dexie
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data !== undefined) {
      // Note: Sync even with stale cache data - having stale data is better than no data

      syncElectricToDexie(electricResult.data)
        .then(() => {
          // Invalidate all strokes queries to trigger cross-device updates
          queryClient.invalidateQueries({ queryKey: ["strokes"] });
        })
        .catch((error) => {
          if (error.name === "DatabaseClosedError") return;
          console.error(
            "[useStrokesSync] Failed to sync Electric data to Dexie:",
            error
          );
        });
    }
  }, [
    electricResult.isLoading,
    electricResult.data,
    electricResult.isFreshData,
    queryClient,
  ]);

  // Run cleanup when Electric confirms sync
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data !== undefined) {
      // Cleanup even with stale data - if Electric has these IDs, local changes should be removed

      const syncedIds = electricResult.data.map((s) => s.id);
      strokesCleanup.cleanupStrokesLocal(syncedIds).catch((error) => {
        if (error.name === "DatabaseClosedError") return;
        console.error("[useStrokesSync] Cleanup failed:", error);
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
// Read Hooks (Public - Called by components)
// ============================================================================

/**
 * Get all strokes for a board (merged: synced + local)
 */
export function useStrokes(boardId: string | undefined) {
  return useQuery({
    queryKey: ["strokes", boardId, "merged"],
    queryFn: () =>
      boardId ? strokesMerged.getMergedStrokesByBoard(boardId) : [],
    enabled: !!boardId,
    staleTime: 0, // Always query fresh for instant feedback
    placeholderData: [], // Prevent loading flicker
  });
}

// ============================================================================
// Write Hooks (Public - Optimistic updates)
// ============================================================================

/**
 * Create a new stroke (optimistic)
 */
export function useCreateStroke() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: Omit<Stroke, "id" | "kind" | "createdAt" | "updatedAt">
    ) => strokesLocal.createStrokeLocal(data),
    onSuccess: (newStroke) => {
      // Immediately refetch merged query for instant UI update
      queryClient.refetchQueries({
        queryKey: ["strokes", newStroke.boardId, "merged"],
      });
    },
  });
}

/**
 * Delete a single stroke (optimistic)
 */
export function useDeleteStroke() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, boardId }: { id: string; boardId: string }) =>
      strokesLocal.deleteStrokeLocal(id),
    onSuccess: (_, variables) => {
      // Immediately refetch merged query for instant UI update
      queryClient.refetchQueries({
        queryKey: ["strokes", variables.boardId, "merged"],
      });
    },
  });
}

/**
 * Delete multiple strokes (optimistic)
 * Used by eraser tool
 */
export function useDeleteStrokes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, boardId }: { ids: string[]; boardId: string }) =>
      strokesLocal.deleteStrokesLocal(ids),
    onSuccess: (_, variables) => {
      // Immediately refetch merged query for instant UI update
      queryClient.refetchQueries({
        queryKey: ["strokes", variables.boardId, "merged"],
      });
    },
  });
}
