import {
    fetchDecks,
    createDeck,
    updateDeck,
    deleteDeck,
} from "../api/deckService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Deck } from "../types/deepRecall/strapi/deckTypes";

export function useDecks() {
  const qc = useQueryClient();

  const {
    data: decks = [],
    isLoading,
    error,
  } = useQuery<Deck[]>({
    queryKey: ["decks"],
    queryFn: fetchDecks,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: createDeck,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decks"] }),
  });

  type UpdateVars = { documentId: string; deck: Deck };
  const updateMutation = useMutation<Deck, Error, UpdateVars>({
    mutationFn: ({ documentId, deck }) => updateDeck(documentId, deck),
    onSuccess: (_ret, { deck }) => {
      qc.setQueryData<Deck[]>(
        ["decks"],
        (old) => old ? old.map(d => d.documentId === deck.documentId ? deck : d) : [deck]
      );
    },
    onError: (err, vars) => {
      console.error("[useDecks] update failed for", vars.documentId, err);
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteDeck,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decks"] }),
  });

  return {
    decks,
    isLoading,
    error,
    createDeck: createMutation.mutateAsync,
    updateDeck: updateMutation.mutateAsync,
    deleteDeck: deleteMutation.mutateAsync,
  };
}