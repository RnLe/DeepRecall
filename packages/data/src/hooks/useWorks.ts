/**
 * React hooks for Works using Electric + WriteBuffer
 * Platform-agnostic data access with real-time sync
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Work, WorkExtended } from "@deeprecall/core";
import * as worksElectric from "../repos/works.electric";

// ============================================================================
// Query Hooks (Electric-based, live-synced)
// ============================================================================

/**
 * Hook to get all works (live-synced from Postgres via Electric)
 * Returns: { data, isLoading, error, syncStatus }
 */
export function useWorks() {
  return worksElectric.useWorks();
}

/**
 * Hook to get a single work by ID (live-synced)
 */
export function useWork(id: string | undefined) {
  const result = worksElectric.useWork(id);

  // Transform to return single work or undefined (not array)
  return {
    ...result,
    data: result.data?.[0],
  };
}

/**
 * Hook to get works by type (live-synced)
 */
export function useWorksByType(workType: string) {
  return worksElectric.useWorksByType(workType);
}

/**
 * Hook to get favorite works (live-synced)
 */
export function useFavoriteWorks() {
  return worksElectric.useFavoriteWorks();
}

/**
 * Hook to search works by title (client-side filtering)
 * Note: Requires loading all works first
 */
export function useSearchWorks(query: string) {
  const { data, isLoading, error, syncStatus } = useWorks();

  return {
    data: data ? worksElectric.searchWorksByTitle(data, query) : undefined,
    isLoading,
    error,
    syncStatus,
  };
}

// ============================================================================
// Mutation Hooks (WriteBuffer-based, optimistic)
// ============================================================================

/**
 * Hook to create a new work
 * Writes to buffer immediately, syncs in background
 */
export function useCreateWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Work, "id" | "createdAt" | "updatedAt">) => {
      return worksElectric.createWork(data);
    },
    onSuccess: (newWork: Work) => {
      console.log(
        `[useCreateWork] Created work ${newWork.id} (queued for sync)`
      );

      // Optimistically invalidate queries (Electric will sync back)
      queryClient.invalidateQueries({ queryKey: ["works"] });
    },
    onError: (error: Error) => {
      console.error("[useCreateWork] Failed to create work:", error);
    },
  });
}

/**
 * Hook to update a work
 * Writes to buffer immediately, syncs in background
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
      await worksElectric.updateWork(id, updates);
      return { id, updates };
    },
    onSuccess: ({ id }: { id: string; updates: Partial<Work> }) => {
      console.log(`[useUpdateWork] Updated work ${id} (queued for sync)`);

      // Optimistically invalidate queries
      queryClient.invalidateQueries({ queryKey: ["works"] });
      queryClient.invalidateQueries({ queryKey: ["work", id] });
    },
    onError: (error: Error) => {
      console.error("[useUpdateWork] Failed to update work:", error);
    },
  });
}

/**
 * Hook to delete a work
 * Writes to buffer immediately, syncs in background
 */
export function useDeleteWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await worksElectric.deleteWork(id);
      return id;
    },
    onSuccess: (id: string) => {
      console.log(`[useDeleteWork] Deleted work ${id} (queued for sync)`);

      // Optimistically invalidate queries
      queryClient.invalidateQueries({ queryKey: ["works"] });
      queryClient.invalidateQueries({ queryKey: ["work", id] });
    },
    onError: (error: Error) => {
      console.error("[useDeleteWork] Failed to delete work:", error);
    },
  });
}

/**
 * Hook to toggle favorite status
 * Convenience wrapper around updateWork
 */
export function useToggleWorkFavorite() {
  const updateWork = useUpdateWork();

  return useMutation({
    mutationFn: async (work: Work) => {
      await worksElectric.toggleWorkFavorite(work);
      return work;
    },
    onSuccess: (work: Work) => {
      console.log(`[useToggleWorkFavorite] Toggled favorite for ${work.id}`);
    },
    onError: (error: Error) => {
      console.error(
        "[useToggleWorkFavorite] Failed to toggle favorite:",
        error
      );
    },
  });
}

/**
 * Hook to create a work with its first asset
 * Both operations enqueued as separate writes
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
      return worksElectric.createWorkWithAsset(params);
    },
    onSuccess: ({ work, asset }: { work: Work; asset: any }) => {
      console.log(
        `[useCreateWorkWithAsset] Created work ${work.id}${
          asset ? ` with asset ${asset.id}` : ""
        } (queued for sync)`
      );

      // Invalidate both works and assets queries
      queryClient.invalidateQueries({ queryKey: ["works"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (error: Error) => {
      console.error(
        "[useCreateWorkWithAsset] Failed to create work with asset:",
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
