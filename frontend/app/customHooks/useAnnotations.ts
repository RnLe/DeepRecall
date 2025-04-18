// useAnnotations.ts – React‑Query v5 compliant

import {
    fetchAnnotations,
    createAnnotation as apiCreate,
    updateAnnotation as apiUpdate,
    deleteAnnotation as apiDelete,
  } from "../api/annotationService";
  import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  import { Annotation } from "../types/annotationTypes";
  
  export function useAnnotations(literatureId?: string) {
    const qc = useQueryClient();
  
    /* ----------------------------- READ ---------------------------- */
  
    const {
      data: annotations = [], // default so callers never see undefined
      isPending: isLoading,
      error,
    } = useQuery<Annotation[]>({
      queryKey: ["annotations", literatureId],
      queryFn: () => fetchAnnotations(literatureId),
      enabled: literatureId !== undefined,
    });
  
    /* invalidates list after any write */
    const invalidate = () =>
      qc.invalidateQueries({ queryKey: ["annotations", literatureId] });
  
    /* --------------------------- CREATE --------------------------- */
  
    const createMutation = useMutation({
      mutationFn: apiCreate,
      onSuccess: invalidate,
    });
  
    /* --------------------------- UPDATE --------------------------- */
  
    type UpdateVars = { id: string; ann: Annotation };
    const updateMutation = useMutation<Annotation, Error, UpdateVars>({
      mutationFn: ({ id, ann }) => apiUpdate(id, ann),
      onSuccess: invalidate,
    });
  
    /* --------------------------- DELETE --------------------------- */
  
    const deleteMutation = useMutation<void, Error, string>({
      mutationFn: apiDelete,
      onSuccess: invalidate,
    });
  
    /* --------------------------- API ----------------------------- */
  
    return {
      annotations,
      isLoading,
      error,
      createAnnotation: createMutation.mutateAsync,
      updateAnnotation: updateMutation.mutateAsync,
      deleteAnnotation: deleteMutation.mutateAsync,
    };
  }
  