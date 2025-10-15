// src/customHooks/useAnnotationTags.ts
/**
 * React‑Query helper for annotation tags.
 * Supports a “search” string so we can fuzzy‑filter while typing.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnnotationTag } from "../types/deepRecall/strapi/annotationTagTypes";
import { fetchTags, createTag, updateTag, deleteTag } from "../../src/api/annotationTagService";

/* -------------------------------------------------------------- */
/* HOOK                                                            */
/* -------------------------------------------------------------- */
export function useAnnotationTags(search: string = "") {
  const qc = useQueryClient();

  /* --------------- read (with fuzzy search) --------------- */
  const {
    data: tags = [],
    isPending: isLoading,
    error,
  } = useQuery<AnnotationTag[]>({
    queryKey: ["annotation-tags", search],
    queryFn: () => fetchTags(search),
  });

  /* --------------- create (invalidate list) --------------- */
  const createMutation = useMutation({
    mutationFn: createTag,
    onSuccess: () => {
      /* refresh *every* search cache – cheapest approach */
      qc.invalidateQueries({ queryKey: ["annotation-tags"] });
    },
  });

  /* --------------- update --------------- */
  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateTag(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["annotation-tags"] }),
  });

  /* --------------- delete --------------- */
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["annotation-tags"] }),
  });

  return {
    tags,
    isLoading,
    error,
    createTag: createMutation.mutateAsync,
    updateTag: updateMutation.mutateAsync,
    deleteTag: deleteMutation.mutateAsync,
  };
}
