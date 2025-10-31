/**
 * React hooks for Annotations using Two-Layer Architecture
 * - Read: Merged data (synced + local) for instant feedback
 * - Write: Local layer (optimistic) with background sync
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Annotation,
  CreateAnnotationInput,
  UpdateAnnotationInput,
} from "@deeprecall/core";
import * as annotationsElectric from "../repos/annotations.electric";
import * as annotationsLocal from "../repos/annotations.local";
import * as annotationsMerged from "../repos/annotations.merged";
import * as annotationsCleanup from "../repos/annotations.cleanup";
import { db } from "../db";
import { useEffect } from "react";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sync Electric data to Dexie annotations table
 * Replaces entire table to ensure deletions are reflected
 *
 * CRITICAL: Must handle empty arrays to clear stale data
 */
async function syncElectricToDexie(electricData: Annotation[]): Promise<void> {
  await db.transaction("rw", db.annotations, async () => {
    // Get current IDs in Dexie
    const currentIds = new Set(
      await db.annotations.toCollection().primaryKeys()
    );

    // Get IDs from Electric
    const electricIds = new Set(electricData.map((a) => a.id));

    // Find IDs to delete (in Dexie but not in Electric)
    const idsToDelete = Array.from(currentIds).filter(
      (id) => !electricIds.has(id)
    );

    // Delete stale records
    if (idsToDelete.length > 0) {
      await db.annotations.bulkDelete(idsToDelete);
      console.log(
        `[Electric→Dexie] Deleted ${idsToDelete.length} stale annotation(s)`
      );
    }

    // Add/update records from Electric
    if (electricData.length > 0) {
      await db.annotations.bulkPut(electricData);
      console.log(
        `[Electric→Dexie] Synced ${electricData.length} annotation(s)`
      );
    }

    // Log final state
    if (idsToDelete.length === 0 && electricData.length === 0) {
      console.log(`[Electric→Dexie] Annotations table cleared (0 rows)`);
    }
  });
}

// ============================================================================
// Sync Hooks (Internal - Called by SyncManager only)
// ============================================================================

/**
 * Internal sync hook: Subscribes to Electric (all annotations) and syncs to Dexie
 * CRITICAL: Must only be called ONCE by SyncManager to prevent race conditions
 *
 * DO NOT call this from components! Use useAnnotations() or usePDFAnnotations() instead.
 */
export function useAnnotationsSync() {
  const electricResult = annotationsElectric.useAnnotations();
  const queryClient = useQueryClient();

  // Sync Electric data to Dexie annotations table (for merge layer)
  useEffect(() => {
    if (
      !electricResult.isLoading &&
      electricResult.data !== undefined
      // Note: Sync even with stale cache data - having stale data is better than no data
    ) {
      syncElectricToDexie(electricResult.data)
        .then(() => {
          // Invalidate all annotations queries to trigger cross-device updates
          queryClient.invalidateQueries({ queryKey: ["annotations"] });
        })
        .catch((error) => {
          if (error.name === "DatabaseClosedError") return;
          console.error(
            "[useAnnotationsSync] Failed to sync Electric data to Dexie:",
            error
          );
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
      annotationsCleanup
        .cleanupSyncedAnnotations(electricResult.data)
        .catch((error) => {
          if (error.name === "DatabaseClosedError") return;
          console.error("[useAnnotationsSync] Failed to cleanup:", error);
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
 * Hook to get all annotations for a PDF (merged: synced + pending local changes)
 * Returns instant feedback with _local metadata for sync status
 *
 * This is a READ-ONLY hook with no side effects.
 * Sync is handled by useAnnotationsSync() in SyncManager.
 */
export function usePDFAnnotations(sha256: string) {
  return useQuery({
    queryKey: ["annotations", "merged", "pdf", sha256],
    queryFn: async () => {
      return annotationsMerged.getMergedPDFAnnotations(sha256);
    },
    staleTime: 0, // Always check for local changes
  });
}

/**
 * Hook to get annotations for a specific page (merged)
 * READ-ONLY: No sync side effects (handled by useAnnotationsSync)
 */
export function usePageAnnotations(sha256: string, page: number) {
  return useQuery({
    queryKey: ["annotations", "merged", "page", sha256, page],
    queryFn: async () => {
      return annotationsMerged.getMergedPageAnnotations(sha256, page);
    },
    staleTime: 0,
  });
}

/**
 * Hook to get a single annotation by ID (merged)
 * READ-ONLY: No sync side effects (handled by useAnnotationsSync)
 */
export function useAnnotation(id: string | undefined) {
  return useQuery({
    queryKey: ["annotations", "merged", id],
    queryFn: async () => {
      if (!id) return undefined;
      return annotationsMerged.getMergedAnnotation(id);
    },
    enabled: !!id,
    staleTime: 0,
  });
}

/**
 * Hook to get all annotations (merged) - use sparingly, prefer filtered queries
 * READ-ONLY: No sync side effects (handled by useAnnotationsSync)
 */
export function useAnnotations() {
  return useQuery({
    queryKey: ["annotations", "merged"],
    queryFn: async () => {
      return annotationsMerged.getAllMergedAnnotations();
    },
    staleTime: 0,
  });
}

/**
 * Hook to get recent annotations (merged)
 * READ-ONLY: No sync side effects (handled by useAnnotationsSync)
 */
export function useRecentAnnotations(limit: number = 10) {
  return useQuery({
    queryKey: ["annotations", "merged", "recent", limit],
    queryFn: async () => {
      return annotationsMerged.getRecentMergedAnnotations(limit);
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
 * Hook to create a new annotation (instant local write)
 * Writes to local Dexie immediately, syncs in background
 */
export function useCreateAnnotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAnnotationInput) => {
      return annotationsLocal.createAnnotationLocal(input);
    },
    onSuccess: (newAnnotation: Annotation) => {
      console.log(
        `✅ [useCreateAnnotation] Created annotation ${newAnnotation.id} (pending sync)`
      );
      // Invalidate merged queries to show new annotation immediately
      queryClient.invalidateQueries({ queryKey: ["annotations", "merged"] });
    },
    onError: (error: Error) => {
      console.error(
        "❌ [useCreateAnnotation] Failed to create annotation:",
        error
      );
    },
  });
}

/**
 * Hook to update an annotation (instant local write)
 */
export function useUpdateAnnotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateAnnotationInput) => {
      await annotationsLocal.updateAnnotationLocal(input);
      return input;
    },
    onSuccess: (input: UpdateAnnotationInput) => {
      console.log(
        `✅ [useUpdateAnnotation] Updated annotation ${input.id} (pending sync)`
      );
      // Invalidate merged queries
      queryClient.invalidateQueries({ queryKey: ["annotations", "merged"] });
    },
    onError: (error: Error) => {
      console.error(
        "❌ [useUpdateAnnotation] Failed to update annotation:",
        error
      );
    },
  });
}

/**
 * Hook to delete an annotation (instant local write)
 */
export function useDeleteAnnotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await annotationsLocal.deleteAnnotationLocal(id);
      return id;
    },
    onSuccess: (id: string) => {
      console.log(
        `✅ [useDeleteAnnotation] Deleted annotation ${id} (pending sync)`
      );
      // Invalidate merged queries to remove immediately
      queryClient.invalidateQueries({ queryKey: ["annotations", "merged"] });
    },
    onError: (error: Error) => {
      console.error(
        "❌ [useDeleteAnnotation] Failed to delete annotation:",
        error
      );
    },
  });
}

/**
 * Hook to bulk create annotations (instant local writes)
 */
export function useBulkCreateAnnotations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inputs: CreateAnnotationInput[]) => {
      const created = await Promise.all(
        inputs.map((input) => annotationsLocal.createAnnotationLocal(input))
      );
      return created;
    },
    onSuccess: (annotations: Annotation[]) => {
      console.log(
        `✅ [useBulkCreateAnnotations] Created ${annotations.length} annotations (pending sync)`
      );
      // Invalidate merged queries
      queryClient.invalidateQueries({ queryKey: ["annotations", "merged"] });
    },
    onError: (error: Error) => {
      console.error("❌ [useBulkCreateAnnotations] Failed:", error);
    },
  });
}
