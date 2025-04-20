// src/customHooks/useAnnotationGroups.ts
/**
 * React‑Query wrapper for annotation groups.
 * Currently only “read” + “create” – identical pattern to Tags.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnnotationGroup } from "../types/annotationTypes";
import { fetchGroups, createGroup, updateGroup, deleteGroup } from "../api/annotationGroupService";

export function useAnnotationGroups() {
  const qc = useQueryClient();

  /* ------------------------ READ ------------------------ */
  const {
    data: groups = [],
    isPending: isLoading,
    error,
  } = useQuery<AnnotationGroup[]>({
    queryKey: ["annotation-groups"],
    queryFn: fetchGroups,
  });

    console.log("Fetched groups", groups);

  /* ----------------------- CREATE ----------------------- */
  const createMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["annotation-groups"] });
    },
  });

  /* ----------------------- UPDATE ----------------------- */
  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateGroup(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["annotation-groups"] }),
  });

  /* ----------------------- DELETE ----------------------- */
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGroup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["annotation-groups"] }),
  });

  return {
    groups,
    isLoading,
    error,
    createGroup: createMutation.mutateAsync,
    updateGroup: updateMutation.mutateAsync,
    deleteGroup: deleteMutation.mutateAsync,
  };
}
