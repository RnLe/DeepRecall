/**
 * React hooks for Activities using Electric + WriteBuffer
 * Platform-agnostic data access with real-time sync
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Activity } from "@deeprecall/core";
import * as activitiesElectric from "../repos/activities.electric";

// ============================================================================
// Query Hooks (Electric-based, live-synced)
// ============================================================================

/**
 * Hook to get all activities (live-synced from Postgres via Electric)
 */
export function useActivities() {
  return activitiesElectric.useActivities();
}

/**
 * Hook to get a single activity by ID (live-synced)
 */
export function useActivity(id: string | undefined) {
  return activitiesElectric.useActivity(id);
}

/**
 * Hook to get activities by type (live-synced)
 */
export function useActivitiesByType(activityType: string) {
  return activitiesElectric.useActivitiesByType(activityType);
}

/**
 * Hook to search activities by title (client-side filtering)
 */
export function useSearchActivities(query: string) {
  const { data, isLoading, error, syncStatus } = useActivities();

  return {
    data: data
      ? activitiesElectric.searchActivitiesByTitle(data, query)
      : undefined,
    isLoading,
    error,
    syncStatus,
  };
}

/**
 * Hook to get activities in date range (client-side filtering)
 */
export function useActivitiesInRange(startDate: string, endDate: string) {
  const { data, isLoading, error, syncStatus } = useActivities();

  return {
    data: data
      ? activitiesElectric.listActivitiesInRange(data, startDate, endDate)
      : undefined,
    isLoading,
    error,
    syncStatus,
  };
}

// ============================================================================
// Mutation Hooks (WriteBuffer-based, optimistic)
// ============================================================================

/**
 * Hook to create a new activity
 */
export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Omit<Activity, "id" | "createdAt" | "updatedAt">
    ) => {
      return activitiesElectric.createActivity(data);
    },
    onSuccess: (newActivity: Activity) => {
      console.log(
        `[useCreateActivity] Created activity ${newActivity.id} (queued for sync)`
      );
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (error: Error) => {
      console.error("[useCreateActivity] Failed to create activity:", error);
    },
  });
}

/**
 * Hook to update an activity
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
      await activitiesElectric.updateActivity(id, updates);
      return { id, updates };
    },
    onSuccess: ({ id }: { id: string; updates: Partial<Activity> }) => {
      console.log(
        `[useUpdateActivity] Updated activity ${id} (queued for sync)`
      );
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", id] });
    },
    onError: (error: Error) => {
      console.error("[useUpdateActivity] Failed to update activity:", error);
    },
  });
}

/**
 * Hook to delete an activity
 */
export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await activitiesElectric.deleteActivity(id);
      return id;
    },
    onSuccess: (id: string) => {
      console.log(
        `[useDeleteActivity] Deleted activity ${id} (queued for sync)`
      );
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", id] });
    },
    onError: (error: Error) => {
      console.error("[useDeleteActivity] Failed to delete activity:", error);
    },
  });
}
