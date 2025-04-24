// src/hooks/useMeepProjects.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
} from "../api/meepProjectService";
import { MeepProject } from "../types/meepStudio/meepProjectTypes";

export function useMeepProjects() {
  const qc = useQueryClient();

  /* ---------- READ ---------- */
  const {
    data: projects = [],
    isLoading,
    error,
  } = useQuery<MeepProject[]>({
    queryKey: ["meepProjects"],
    queryFn: fetchProjects,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  /* ---------- CREATE ---------- */
  const createMut = useMutation({
    mutationFn: createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meepProjects"] }),
  });

  /* ---------- UPDATE ---------- */
  const updateMut = useMutation({
    mutationFn: updateProject,
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["meepProjects"] });
      const prev = qc.getQueryData<MeepProject[]>(["meepProjects"]);
      if (prev) {
        qc.setQueryData<MeepProject[]>(["meepProjects"], (old) =>
          old!.map((p) => (p.documentId === vars.documentId ? vars.project : p))
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["meepProjects"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["meepProjects"] }),
  });

  /* ---------- DELETE ---------- */
  const deleteMut = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meepProjects"] }),
  });

  return {
    projects,
    isLoading,
    error,
    createProject: createMut.mutateAsync,
    updateProject: updateMut.mutateAsync,
    deleteProject: deleteMut.mutateAsync,
  };
}