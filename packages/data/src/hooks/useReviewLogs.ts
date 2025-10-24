/**
 * React hooks for ReviewLogs using Two-Layer Architecture
 * - Read: Merged data (synced + local) for instant feedback
 * - Write: Local layer (optimistic) with background sync
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReviewLog } from "@deeprecall/core";
import * as cardsElectric from "../repos/cards.electric";
import * as reviewLogsLocal from "../repos/reviewLogs.local";
import * as reviewLogsMerged from "../repos/reviewLogs.merged";
import * as reviewLogsCleanup from "../repos/reviewLogs.cleanup";
import { db } from "../db";
import { useEffect } from "react";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sync Electric data to Dexie reviewLogs table
 * Replaces entire table to ensure deletions are reflected
 *
 * CRITICAL: Must handle empty arrays to clear stale data
 */
async function syncElectricToDexie(electricData: ReviewLog[]): Promise<void> {
  await db.transaction("rw", db.reviewLogs, async () => {
    // Get current IDs in Dexie
    const currentIds = new Set(
      await db.reviewLogs.toCollection().primaryKeys()
    );

    // Get IDs from Electric
    const electricIds = new Set(electricData.map((r) => r.id));

    // Find IDs to delete (in Dexie but not in Electric)
    const idsToDelete = Array.from(currentIds).filter(
      (id) => !electricIds.has(id)
    );

    // Delete stale records
    if (idsToDelete.length > 0) {
      await db.reviewLogs.bulkDelete(idsToDelete);
      console.log(
        `[Electric→Dexie] Deleted ${idsToDelete.length} stale review log(s)`
      );
    }

    // Add/update records from Electric
    if (electricData.length > 0) {
      await db.reviewLogs.bulkPut(electricData);
      console.log(
        `[Electric→Dexie] Synced ${electricData.length} review log(s)`
      );
    }

    // Log final state
    if (idsToDelete.length === 0 && electricData.length === 0) {
      console.log(`[Electric→Dexie] ReviewLogs table cleared (0 rows)`);
    }
  });
}

// ============================================================================
// Query Hooks (Merged Layer: Synced + Local)
// ============================================================================

/**
 * Hook to get review logs for a card (merged: synced + pending local changes)
 */
export function useReviewLogsByCard(cardId: string) {
  const electricResult = cardsElectric.useReviewLogsByCard(cardId);

  // Sync Electric data to Dexie
  // CRITICAL: Only sync after initial load to preserve cached data on page reload
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data !== undefined) {
      syncElectricToDexie(electricResult.data).catch((error) => {
        console.error(
          "[useReviewLogsByCard] Failed to sync Electric data to Dexie:",
          error
        );
      });
    }
  }, [electricResult.isLoading, electricResult.data]);

  const mergedQuery = useQuery({
    queryKey: ["reviewLogs", "merged", "card", cardId],
    queryFn: async () => {
      return reviewLogsMerged.getMergedReviewLogsByCard(cardId);
    },
    staleTime: 0,
    placeholderData: [], // Show empty array while loading (prevents loading state)
  });

  // CRITICAL: Check isLoading to avoid cleanup on initial undefined state
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data) {
      reviewLogsCleanup
        .cleanupSyncedReviewLogs(electricResult.data)
        .then(() => {
          mergedQuery.refetch();
        });
    }
  }, [electricResult.isLoading, electricResult.data]);

  return {
    ...mergedQuery,
    isLoading: electricResult.isLoading || mergedQuery.isLoading,
  };
}

// ============================================================================
// Mutation Hooks (Local Layer: Optimistic Writes)
// ============================================================================

/**
 * Hook to create a new review log (instant local write)
 */
export function useCreateReviewLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (log: ReviewLog) => {
      return reviewLogsLocal.createReviewLogLocal(log);
    },
    onSuccess: (newLog: ReviewLog) => {
      console.log(
        `✅ [useCreateReviewLog] Created review log ${newLog.id} (pending sync)`
      );
      queryClient.invalidateQueries({ queryKey: ["reviewLogs", "merged"] });
    },
    onError: (error: Error) => {
      console.error(
        "❌ [useCreateReviewLog] Failed to create review log:",
        error
      );
    },
  });
}

/**
 * Hook to delete a review log (instant local write)
 * Note: Review logs are typically append-only, but deletion is supported
 */
export function useDeleteReviewLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await reviewLogsLocal.deleteReviewLogLocal(id);
      return id;
    },
    onSuccess: (id: string) => {
      console.log(
        `✅ [useDeleteReviewLog] Deleted review log ${id} (pending sync)`
      );
      queryClient.invalidateQueries({ queryKey: ["reviewLogs", "merged"] });
    },
    onError: (error: Error) => {
      console.error(
        "❌ [useDeleteReviewLog] Failed to delete review log:",
        error
      );
    },
  });
}
