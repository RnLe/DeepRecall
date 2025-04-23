import {
    fetchKnowledgePacks,
    createKnowledgePack,
    updateKnowledgePack,
    deleteKnowledgePack,
} from "../api/knowledgePackService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KnowledgePack } from "../types/deepRecall/strapi/knowledgePackTypes";

export function useKnowledgePacks() {
  const qc = useQueryClient();

  const {
    data: packs = [],
    isLoading,
    error,
  } = useQuery<KnowledgePack[]>({
    queryKey: ["knowledgePacks"],
    queryFn: fetchKnowledgePacks,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: createKnowledgePack,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledgePacks"] }),
  });

  type UpdateVars = { documentId: string; pack: KnowledgePack };
  const updateMutation = useMutation<KnowledgePack, Error, UpdateVars>({
    mutationFn: ({ documentId, pack }) => updateKnowledgePack(documentId, pack),
    onSuccess: (_ret, { pack }) => {
      qc.setQueryData<KnowledgePack[]>(
        ["knowledgePacks"],
        (old) => old ? old.map(p => p.documentId === pack.documentId ? pack : p) : [pack]
      );
    },
    onError: (err, vars) => {
      console.error("[useKnowledgePacks] update failed for", vars.documentId, err);
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteKnowledgePack,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledgePacks"] }),
  });

  return {
    packs,
    isLoading,
    error,
    createKnowledgePack: createMutation.mutateAsync,
    updateKnowledgePack: updateMutation.mutateAsync,
    deleteKnowledgePack: deleteMutation.mutateAsync,
  };
}