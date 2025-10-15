// useAnnotations.ts
import {
  fetchAnnotations,
  fetchAnnotationCounts,
  createAnnotation as apiCreate,
  updateAnnotation as apiUpdate,
  deleteAnnotation as apiDelete,
} from "../../src/api/annotationService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Annotation } from "../types/deepRecall/strapi/annotationTypes";
import { updateVersionAnnotationCount } from "../services/versionService";

export function useAnnotations(literatureId: string, pdfId: string) {
  const qc = useQueryClient();

  /* ----------------------------- READ ---------------------------- */
  const {
    data: annotations = [],
    isPending: isLoading,
    error,
  } = useQuery<Annotation[]>({
    queryKey: ["annotations", literatureId, pdfId],
    queryFn: () => fetchAnnotations(literatureId, pdfId),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  /* --------------------------- CREATE --------------------------- */
  const createMutation = useMutation({
    mutationFn: apiCreate,
    onSuccess: async (createdAnnotation) => {
      console.log(`DEBUG: Annotation created successfully, updating count for literature ${literatureId}, version ${pdfId}`);
      
      // Invalidate annotations query
      qc.invalidateQueries({ queryKey: ["annotations", literatureId, pdfId] });
      
      // Update version annotation count
      try {
        await updateVersionAnnotationCount(literatureId, pdfId, 1);
        // Invalidate literature queries to refresh version counts in UI
        qc.invalidateQueries({ queryKey: ["literatures"] });
        console.log(`DEBUG: Successfully updated annotation count (+1) for version ${pdfId}`);
      } catch (error) {
        console.error("Failed to update version annotation count on create:", error);
      }
    },
  });

  /* --------------------------- UPDATE --------------------------- */
  type UpdateVars = { documentId: string; ann: Annotation };
  const updateMutation = useMutation<Annotation, Error, UpdateVars>({
    mutationFn: ({ documentId, ann }) => apiUpdate(documentId, ann),
    onSuccess: (_returned, { ann }) => {
      // write the exact annotation we passed in back into the cache
      qc.setQueryData<Annotation[]>(
        ["annotations", literatureId, pdfId],
        (old) =>
          old
            ? old.map((a) =>
                a.documentId === ann.documentId ? ann : a
              )
            : [ann]
      );
    },
    onError: (err, vars) => {
      console.error(
        "[useAnnotations] updateMutation failed for",
        vars.documentId,
        err
      );
    },
  });

  /* --------------------------- DELETE ---------------------------- */
  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: apiDelete,
    onSuccess: async () => {
      console.log(`DEBUG: Annotation deleted successfully, updating count for literature ${literatureId}, version ${pdfId}`);
      
      // Invalidate annotations query
      qc.invalidateQueries({ queryKey: ["annotations", literatureId, pdfId] });
      
      // Update version annotation count
      try {
        await updateVersionAnnotationCount(literatureId, pdfId, -1);
        // Invalidate literature queries to refresh version counts in UI
        qc.invalidateQueries({ queryKey: ["literatures"] });
        console.log(`DEBUG: Successfully updated annotation count (-1) for version ${pdfId}`);
      } catch (error) {
        console.error("Failed to update version annotation count on delete:", error);
      }
    },
  });

  return {
    annotations,
    isLoading,
    error,
    createAnnotation: createMutation.mutateAsync,
    updateAnnotation: updateMutation.mutateAsync,
    deleteAnnotation: deleteMutation.mutateAsync,
  };
}

// Hook to get annotation counts for multiple pdfIds
export function useAnnotationCounts(literatureId: string, pdfIds: string[]) {
  const {
    data: counts = {},
    isPending: isLoading,
    error,
  } = useQuery<Record<string, number>>({
    queryKey: ["annotation-counts", literatureId, pdfIds],
    queryFn: () => fetchAnnotationCounts(literatureId, pdfIds),
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
    refetchOnWindowFocus: false,
    enabled: pdfIds.length > 0, // Only run if we have pdfIds
  });

  return {
    counts,
    isLoading,
    error,
  };
}
