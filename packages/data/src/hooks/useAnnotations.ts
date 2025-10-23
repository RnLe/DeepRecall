/**
 * React hooks for Annotations using Electric + WriteBuffer
 * Platform-agnostic data access with real-time sync
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Annotation,
  CreateAnnotationInput,
  UpdateAnnotationInput,
} from "@deeprecall/core";
import * as annotationsElectric from "../repos/annotations.electric";

// ============================================================================
// Query Hooks (Electric-based, live-synced)
// ============================================================================

export function usePDFAnnotations(sha256: string) {
  return annotationsElectric.usePDFAnnotations(sha256);
}

export function usePageAnnotations(sha256: string, page: number) {
  return annotationsElectric.usePageAnnotations(sha256, page);
}

export function useAnnotation(id: string | undefined) {
  return annotationsElectric.useAnnotation(id);
}

export function useAnnotations() {
  return annotationsElectric.useAnnotations();
}

export function useRecentAnnotations(limit?: number) {
  return annotationsElectric.useRecentAnnotations(limit);
}

// ============================================================================
// Mutation Hooks (WriteBuffer-based, optimistic)
// ============================================================================

export function useCreateAnnotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAnnotationInput) => {
      return annotationsElectric.createAnnotation(input);
    },
    onSuccess: (newAnnotation: Annotation) => {
      console.log(
        `[useCreateAnnotation] Created annotation ${newAnnotation.id}`
      );
      queryClient.invalidateQueries({ queryKey: ["annotations"] });
    },
    onError: (error: Error) => {
      console.error("[useCreateAnnotation] Failed:", error);
    },
  });
}

export function useUpdateAnnotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateAnnotationInput) => {
      await annotationsElectric.updateAnnotation(input);
      return input;
    },
    onSuccess: (input: UpdateAnnotationInput) => {
      console.log(`[useUpdateAnnotation] Updated annotation ${input.id}`);
      queryClient.invalidateQueries({ queryKey: ["annotations"] });
    },
    onError: (error: Error) => {
      console.error("[useUpdateAnnotation] Failed:", error);
    },
  });
}

export function useDeleteAnnotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await annotationsElectric.deleteAnnotation(id);
      return id;
    },
    onSuccess: (id: string) => {
      console.log(`[useDeleteAnnotation] Deleted annotation ${id}`);
      queryClient.invalidateQueries({ queryKey: ["annotations"] });
    },
    onError: (error: Error) => {
      console.error("[useDeleteAnnotation] Failed:", error);
    },
  });
}

export function useBulkCreateAnnotations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inputs: CreateAnnotationInput[]) => {
      return annotationsElectric.bulkCreateAnnotations(inputs);
    },
    onSuccess: (annotations: Annotation[]) => {
      console.log(
        `[useBulkCreateAnnotations] Created ${annotations.length} annotations`
      );
      queryClient.invalidateQueries({ queryKey: ["annotations"] });
    },
    onError: (error: Error) => {
      console.error("[useBulkCreateAnnotations] Failed:", error);
    },
  });
}
