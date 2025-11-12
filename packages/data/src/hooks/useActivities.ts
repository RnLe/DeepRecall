/**
 * React hooks for Activities using Two-Layer Architecture
 * - Read: Merged data (synced + local) for instant feedback
 * - Write: Local layer (optimistic) with background sync
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Activity } from "@deeprecall/core";
import * as activitiesElectric from "../repos/activities.electric";
import * as activitiesLocal from "../repos/activities.local";
import * as activitiesMerged from "../repos/activities.merged";
import * as activitiesCleanup from "../repos/activities.cleanup";
import { db } from "../db";
import { useEffect } from "react";
import { logger } from "@deeprecall/telemetry";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sync Electric data to Dexie activities table
 * Replaces entire table to ensure deletions are reflected
 *
 * CRITICAL: Must handle empty arrays to clear stale data
 */
async function syncElectricToDexie(electricData: Activity[]): Promise<void> {
  await db.transaction("rw", db.activities, async () => {
    // Get current IDs in Dexie
    const currentIds = new Set(
      await db.activities.toCollection().primaryKeys()
    );

    // Get IDs from Electric
    const electricIds = new Set(electricData.map((a) => a.id));

    // Find IDs to delete (in Dexie but not in Electric)
    const idsToDelete = Array.from(currentIds).filter(
      (id) => !electricIds.has(id)
    );

    // Delete stale records
    if (idsToDelete.length > 0) {
      await db.activities.bulkDelete(idsToDelete);
      logger.info("sync.electric", "Deleted stale activities from Dexie", {
        count: idsToDelete.length,
        ids: idsToDelete,
      });
    }

    // Add/update records from Electric
    if (electricData.length > 0) {
      await db.activities.bulkPut(electricData);
      logger.info("sync.electric", "Synced activities from Electric to Dexie", {
        count: electricData.length,
      });
    }

    // Log final state
    if (idsToDelete.length === 0 && electricData.length === 0) {
      logger.info("sync.electric", "Activities table cleared", { count: 0 });
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
 * DO NOT call this from components! Use useActivities() instead.
 * @param userId - Filter activities by owner_id (multi-tenant isolation)
 */
export function useActivitiesSync(userId?: string) {
  const electricResult = activitiesElectric.useActivities(userId);
  const queryClient = useQueryClient();

  // Sync Electric data to Dexie activities table (for merge layer)
  useEffect(() => {
    if (
      !electricResult.isLoading &&
      electricResult.data !== undefined
      // Note: Sync even with stale cache data - having stale data is better than no data
    ) {
      syncElectricToDexie(electricResult.data)
        .then(() => {
          // Invalidate all activities queries to trigger cross-device updates
          queryClient.invalidateQueries({ queryKey: ["activities"] });
        })
        .catch((error) => {
          if (error.name === "DatabaseClosedError") return;
          logger.error("sync.electric", "Failed to sync activities to Dexie", {
            error: error.message,
          });
        });
    }
  }, [electricResult.data, electricResult.isFreshData, queryClient]);

  // Run cleanup when Electric confirms sync
  useEffect(() => {
    if (
      !electricResult.isLoading &&
      electricResult.data
      // Cleanup even with stale data - if Electric has these IDs, local changes should be removed
    ) {
      activitiesCleanup
        .cleanupSyncedActivities(electricResult.data)
        .catch((error) => {
          if (error.name === "DatabaseClosedError") return;
          logger.error("db.local", "Failed to cleanup activities", {
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
 * Hook to get all activities (merged: synced + pending local changes)
 * Returns instant feedback with _local metadata for sync status
 *
 * This is a READ-ONLY hook with no side effects.
 * Sync is handled by useActivitiesSync() in SyncManager.
 */
export function useActivities() {
  return useQuery({
    queryKey: ["activities", "merged"],
    queryFn: async () => {
      return activitiesMerged.getAllMergedActivities();
    },
    staleTime: 0, // Always check for local changes
    placeholderData: [], // Show empty array while loading (prevents loading state)
  });
}

/**
 * Hook to get a single activity by ID (merged)
 * READ-ONLY: No sync side effects (handled by useActivitiesSync)
 */
export function useActivity(id: string | undefined) {
  return useQuery({
    queryKey: ["activities", "merged", id],
    queryFn: async () => {
      if (!id) return undefined;
      return activitiesMerged.getMergedActivity(id);
    },
    enabled: !!id,
    staleTime: 0,
  });
}

/**
 * Hook to get activities by type (merged)
 * READ-ONLY: No sync side effects (handled by useActivitiesSync)
 */
export function useActivitiesByType(activityType: string) {
  return useQuery({
    queryKey: ["activities", "merged", "type", activityType],
    queryFn: async () => {
      return activitiesMerged.getMergedActivitiesByType(activityType);
    },
    staleTime: 0,
  });
}

/**
 * Hook to search activities by title (client-side filtering on merged data)
 * READ-ONLY: No sync side effects (handled by useActivitiesSync)
 */
export function useSearchActivities(query: string) {
  return useQuery({
    queryKey: ["activities", "merged", "search", query],
    queryFn: async () => {
      return activitiesMerged.searchMergedActivitiesByTitle(query);
    },
    staleTime: 0,
  });
}

/**
 * Hook to get activities in date range (client-side filtering on merged data)
 * READ-ONLY: No sync side effects (handled by useActivitiesSync)
 */
export function useActivitiesInRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["activities", "merged", "range", startDate, endDate],
    queryFn: async () => {
      return activitiesMerged.getMergedActivitiesInRange(startDate, endDate);
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
 * Hook to create a new activity (instant local write)
 * Writes to local Dexie immediately, syncs in background
 */
export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Omit<Activity, "id" | "kind" | "createdAt" | "updatedAt">
    ) => {
      return activitiesLocal.createActivityLocal(data);
    },
    onSuccess: (newActivity: Activity) => {
      logger.info("db.local", "Created activity locally (pending sync)", {
        activityId: newActivity.id,
      });
      // Invalidate merged queries to show new activity immediately
      queryClient.invalidateQueries({ queryKey: ["activities", "merged"] });
    },
    onError: (error: Error) => {
      logger.error("db.local", "Failed to create activity", {
        error: error.message,
      });
    },
  });
}

/**
 * Hook to update an activity (instant local write)
 */
export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Activity, "id" | "kind" | "createdAt">>;
    }) => {
      await activitiesLocal.updateActivityLocal(id, updates);
      return { id, updates };
    },
    onSuccess: ({ id }: { id: string; updates: Partial<Activity> }) => {
      logger.info("db.local", "Updated activity locally (pending sync)", {
        activityId: id,
      });
      // Invalidate merged queries
      queryClient.invalidateQueries({ queryKey: ["activities", "merged"] });
    },
    onError: (error: Error) => {
      logger.error("db.local", "Failed to update activity", {
        error: error.message,
      });
    },
  });
}

/**
 * Hook to delete an activity (instant local write)
 */
export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await activitiesLocal.deleteActivityLocal(id);
      return id;
    },
    onSuccess: (id: string) => {
      logger.info("db.local", "Deleted activity locally (pending sync)", {
        activityId: id,
      });
      // Invalidate merged queries to remove immediately
      queryClient.invalidateQueries({ queryKey: ["activities", "merged"] });
    },
    onError: (error: Error) => {
      logger.error("db.local", "Failed to delete activity", {
        error: error.message,
      });
    },
  });
}
