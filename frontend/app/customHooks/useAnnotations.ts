// useAnnotations.ts
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
    data: annotations = [],
    isPending: isLoading,
    error,
  } = useQuery<Annotation[]>({
    queryKey: ["annotations", literatureId],
    queryFn: () => fetchAnnotations(literatureId),
    enabled: literatureId !== undefined,
  });

  /* --------------------------- CREATE --------------------------- */
  const createMutation = useMutation({
    mutationFn: apiCreate,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["annotations", literatureId] }),
  });

  /* --------------------------- UPDATE --------------------------- */
  type UpdateVars = { id: string; ann: Annotation };
  const updateMutation = useMutation<Annotation, Error, UpdateVars>({
    mutationFn: ({ id, ann }) => apiUpdate(id, ann),
    onSuccess: (_returned, { ann }) => {
      // write the exact annotation we passed in back into the cache
      qc.setQueryData<Annotation[]>(
        ["annotations", literatureId],
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
        vars.id,
        err
      );
    },
  });

  /* --------------------------- DELETE ---------------------------- */
  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: apiDelete,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["annotations", literatureId] }),
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
