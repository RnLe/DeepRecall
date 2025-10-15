import { 
    fetchDeckCards,
    createDeckCard,
    updateDeckCard,
    deleteDeckCard
} from "../../src/api/deckCardService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DeckCard } from "../types/deepRecall/strapi/deckCardTypes";

export function useDeckCards() {
  const qc = useQueryClient();

  const {
    data: deckCards = [],
    isLoading,
    error,
  } = useQuery<DeckCard[]>({
    queryKey: ["deckCards"],
    queryFn: fetchDeckCards,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: createDeckCard,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deckCards"] }),
  });

  type UpdateVars = { documentId: string; card: DeckCard };
  const updateMutation = useMutation<DeckCard, Error, UpdateVars>({
    mutationFn: ({ documentId, card }) => updateDeckCard(documentId, card),
    onSuccess: (_ret, { card }) => {
      qc.setQueryData<DeckCard[]>(
        ["deckCards"],
        (old) => old ? old.map(c => c.documentId === card.documentId ? card : c) : [card]
      );
    },
    onError: (err, vars) => {
      console.error("[useDeckCards] update failed for", vars.documentId, err);
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteDeckCard,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deckCards"] }),
  });

  return {
    deckCards,
    isLoading,
    error,
    createDeckCard: createMutation.mutateAsync,
    updateDeckCard: updateMutation.mutateAsync,
    deleteDeckCard: deleteMutation.mutateAsync,
  };
}