/**
 * React hooks for ReviewLogs using Two-Layer Architecture
 * - Read: Merged data (synced + local) for instant feedback
 * - Write: Local layer (optimistic) with background sync
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReviewLog } from "@deeprecall/core";
import { useShape } from "../electric";
import * as cardsElectric from "../repos/cards.electric";
import * as reviewLogsLocal from "../repos/reviewLogs.local";
import * as reviewLogsMerged from "../repos/reviewLogs.merged";
import * as reviewLogsCleanup from "../repos/reviewLogs.cleanup";
import { db } from "../db";
import { useEffect } from "react";
import { logger } from "@deeprecall/telemetry";

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
      logger.info("sync.electric", "Deleted stale review logs from Dexie", {
        count: idsToDelete.length,
        ids: idsToDelete,
      });
    }

    // Add/update records from Electric
    if (electricData.length > 0) {
      await db.reviewLogs.bulkPut(electricData);
      logger.info(
        "sync.electric",
        "Synced review logs from Electric to Dexie",
        {
          count: electricData.length,
        }
      );
    }

    // Log final state
    if (idsToDelete.length === 0 && electricData.length === 0) {
      logger.info("sync.electric", "ReviewLogs table cleared", { count: 0 });
    }
  });
}

// ============================================================================
// Sync Hook (Internal: Called ONLY by SyncManager)
// ============================================================================

/**
 * Internal sync hook - subscribes to Electric and syncs to Dexie
 * MUST be called exactly once by SyncManager to avoid race conditions
 * DO NOT call from components - use useReviewLogsByCard() instead
 * @param userId - Owner filter for multi-tenant isolation
 */
export function useReviewLogsSync(userId?: string) {
  const electricResult = cardsElectric.useReviewLogs(userId);
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
          // Invalidate all review logs queries to trigger cross-device updates
          queryClient.invalidateQueries({ queryKey: ["reviewLogs"] });
        })
        .catch((error) => {
          logger.error("sync.electric", "Failed to sync review logs to Dexie", {
            error: error.message,
          });
        });
    }
  }, [electricResult.data, electricResult.isFreshData, queryClient]);

  // Cleanup synced review logs
  useEffect(() => {
    if (
      !electricResult.isLoading &&
      electricResult.data
      // Cleanup even with stale data - if Electric has these IDs, local changes should be removed
    ) {
      reviewLogsCleanup.cleanupSyncedReviewLogs(electricResult.data);
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
 * Hook to get review logs for a card (merged: synced + pending local changes)
 * Read-only - queries Dexie merged view without side effects
 */
export function useReviewLogsByCard(cardId: string) {
  return useQuery({
    queryKey: ["reviewLogs", "merged", "card", cardId],
    queryFn: async () => {
      return reviewLogsMerged.getMergedReviewLogsByCard(cardId);
    },
    staleTime: 0,
    placeholderData: [], // Show empty array while loading (prevents loading state)
  });
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
      logger.info("srs", "Created review log locally (pending sync)", {
        logId: newLog.id,
        cardId: newLog.card_id,
      });
      queryClient.invalidateQueries({ queryKey: ["reviewLogs", "merged"] });
    },
    onError: (error: Error) => {
      logger.error("srs", "Failed to create review log", {
        error: error.message,
      });
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
      logger.info("srs", "Deleted review log locally (pending sync)", {
        logId: id,
      });
      queryClient.invalidateQueries({ queryKey: ["reviewLogs", "merged"] });
    },
    onError: (error: Error) => {
      logger.error("srs", "Failed to delete review log", {
        error: error.message,
      });
    },
  });
}
