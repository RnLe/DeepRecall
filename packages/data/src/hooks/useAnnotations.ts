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
// Query Hooks (Merged Layer: Synced + Local)
// ============================================================================

/**
 * Hook to get all annotations for a PDF (merged: synced + pending local changes)
 * Returns instant feedback with _local metadata for sync status
 * Auto-cleanup when Electric confirms sync
 */
export function usePDFAnnotations(sha256: string) {
  const electricResult = annotationsElectric.usePDFAnnotations(sha256);

  // Sync Electric data to Dexie annotations table (for merge layer)
  // CRITICAL: Must sync even when empty to clear stale data
  useEffect(() => {
    if (electricResult.data !== undefined) {
      syncElectricToDexie(electricResult.data).catch((error) => {
        console.error(
          "[usePDFAnnotations] Failed to sync Electric data to Dexie:",
          error
        );
      });
    }
  }, [electricResult.data]);

  // Query merged data from Dexie
  const mergedQuery = useQuery({
    queryKey: ["annotations", "merged", "pdf", sha256],
    queryFn: async () => {
      return annotationsMerged.getMergedPDFAnnotations(sha256);
    },
    staleTime: 0, // Always check for local changes
  });

  // Auto-cleanup and refresh when Electric data changes (synced)
  useEffect(() => {
    if (electricResult.data) {
      annotationsCleanup
        .cleanupSyncedAnnotations(electricResult.data)
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
 * Hook to get annotations for a specific page (merged)
 */
export function usePageAnnotations(sha256: string, page: number) {
  const electricResult = annotationsElectric.usePageAnnotations(sha256, page);

  const mergedQuery = useQuery({
    queryKey: ["annotations", "merged", "page", sha256, page],
    queryFn: async () => {
      return annotationsMerged.getMergedPageAnnotations(sha256, page);
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

/**
 * Hook to get a single annotation by ID (merged)
 */
export function useAnnotation(id: string | undefined) {
  const electricResult = annotationsElectric.useAnnotation(id);

  const mergedQuery = useQuery({
    queryKey: ["annotations", "merged", id],
    queryFn: async () => {
      if (!id) return undefined;
      return annotationsMerged.getMergedAnnotation(id);
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
 * Hook to get all annotations (merged) - use sparingly, prefer filtered queries
 */
export function useAnnotations() {
  const electricResult = annotationsElectric.useAnnotations();

  // Sync Electric data to Dexie
  useEffect(() => {
    if (electricResult.data !== undefined) {
      syncElectricToDexie(electricResult.data).catch((error) => {
        console.error(
          "[useAnnotations] Failed to sync Electric data to Dexie:",
          error
        );
      });
    }
  }, [electricResult.data]);

  const mergedQuery = useQuery({
    queryKey: ["annotations", "merged"],
    queryFn: async () => {
      return annotationsMerged.getAllMergedAnnotations();
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (electricResult.data) {
      annotationsCleanup
        .cleanupSyncedAnnotations(electricResult.data)
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
 * Hook to get recent annotations (merged)
 */
export function useRecentAnnotations(limit: number = 10) {
  const mergedQuery = useQuery({
    queryKey: ["annotations", "merged", "recent", limit],
    queryFn: async () => {
      return annotationsMerged.getRecentMergedAnnotations(limit);
    },
    staleTime: 0,
  });

  return mergedQuery;
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
