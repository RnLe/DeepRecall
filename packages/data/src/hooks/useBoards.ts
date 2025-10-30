/**
 * React hooks for Boards using Two-Layer Architecture
 * - Read: Merged data (synced + local) for instant feedback
 * - Write: Local layer (optimistic) with background sync
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Board } from "@deeprecall/core";
import * as boardsElectric from "../repos/boards.electric";
import * as boardsLocal from "../repos/boards.local";
import * as boardsMerged from "../repos/boards.merged";
import * as boardsCleanup from "../repos/boards.cleanup";
import { db } from "../db";
import { useEffect } from "react";

/**
 * Sync Electric data to Dexie boards table
 */
async function syncElectricToDexie(electricData: Board[]): Promise<void> {
  await db.transaction("rw", db.boards, async () => {
    // Get current IDs in Dexie
    const currentIds = new Set(await db.boards.toCollection().primaryKeys());

    // Get IDs from Electric
    const electricIds = new Set(electricData.map((b) => b.id));

    // Find IDs to delete (in Dexie but not in Electric)
    const idsToDelete = Array.from(currentIds).filter(
      (id) => !electricIds.has(id)
    );

    // Delete stale records
    if (idsToDelete.length > 0) {
      await db.boards.bulkDelete(idsToDelete);
      console.log(
        `[Electric→Dexie] Deleted ${idsToDelete.length} stale board(s)`
      );
    }

    // Add/update records from Electric
    if (electricData.length > 0) {
      await db.boards.bulkPut(electricData);
      console.log(`[Electric→Dexie] Synced ${electricData.length} board(s)`);
    }

    // Log final state
    if (idsToDelete.length === 0 && electricData.length === 0) {
      console.log(`[Electric→Dexie] Boards table cleared (0 rows)`);
    }
  });
}

// ============================================================================
// Sync Hooks (Internal - Called by SyncManager only)
// ============================================================================

/**
 * Internal sync hook: Subscribes to Electric and syncs to Dexie
 * CRITICAL: Must only be called ONCE by SyncManager
 */
export function useBoardsSync() {
  const electricResult = boardsElectric.useBoards();

  // Sync Electric data to Dexie
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data !== undefined) {
      // Note: Sync even with stale cache data - having stale data is better than no data

      syncElectricToDexie(electricResult.data).catch((error) => {
        if (error.name === "DatabaseClosedError") return;
        console.error(
          "[useBoardsSync] Failed to sync Electric data to Dexie:",
          error
        );
      });
    }
  }, [
    electricResult.isLoading,
    electricResult.data,
    electricResult.isFreshData,
  ]);

  // Run cleanup when Electric confirms sync
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data !== undefined) {
      // Cleanup even with stale data - if Electric has these IDs, local changes should be removed

      const syncedIds = electricResult.data.map((b) => b.id);
      boardsCleanup.cleanupBoardsLocal(syncedIds).catch((error) => {
        if (error.name === "DatabaseClosedError") return;
        console.error("[useBoardsSync] Cleanup failed:", error);
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
 * Get all boards (merged: synced + local)
 */
export function useBoards() {
  return useQuery({
    queryKey: ["boards", "merged"],
    queryFn: () => boardsMerged.getAllMergedBoards(),
    staleTime: 0, // Always query fresh
  });
}

/**
 * Get single board by ID (merged)
 */
export function useBoard(id: string | undefined) {
  return useQuery({
    queryKey: ["boards", id, "merged"],
    queryFn: () => (id ? boardsMerged.getMergedBoardById(id) : null),
    enabled: !!id,
    staleTime: 0,
  });
}

// ============================================================================
// Write Hooks (Public - Optimistic updates)
// ============================================================================

/**
 * Create a new board (optimistic)
 */
export function useCreateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: Omit<Board, "id" | "kind" | "createdAt" | "updatedAt">
    ) => boardsLocal.createBoardLocal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
    },
  });
}

/**
 * Update a board (optimistic)
 */
export function useUpdateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Board, "id" | "kind" | "createdAt">>;
    }) => boardsLocal.updateBoardLocal(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["boards", variables.id] });
    },
  });
}

/**
 * Delete a board (optimistic)
 */
export function useDeleteBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => boardsLocal.deleteBoardLocal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
    },
  });
}
