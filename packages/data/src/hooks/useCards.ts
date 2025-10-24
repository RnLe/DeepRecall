/**
 * React hooks for Cards using Two-Layer Architecture
 * - Read: Merged data (synced + local) for instant feedback
 * - Write: Local layer (optimistic) with background sync
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Card } from "@deeprecall/core";
import * as cardsElectric from "../repos/cards.electric";
import * as cardsLocal from "../repos/cards.local";
import * as cardsMerged from "../repos/cards.merged";
import * as cardsCleanup from "../repos/cards.cleanup";
import { db } from "../db";
import { useEffect } from "react";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sync Electric data to Dexie cards table
 * Replaces entire table to ensure deletions are reflected
 *
 * CRITICAL: Must handle empty arrays to clear stale data
 */
async function syncElectricToDexie(electricData: Card[]): Promise<void> {
  await db.transaction("rw", db.cards, async () => {
    // Get current IDs in Dexie
    const currentIds = new Set(await db.cards.toCollection().primaryKeys());

    // Get IDs from Electric
    const electricIds = new Set(electricData.map((c) => c.id));

    // Find IDs to delete (in Dexie but not in Electric)
    const idsToDelete = Array.from(currentIds).filter(
      (id) => !electricIds.has(id)
    );

    // Delete stale records
    if (idsToDelete.length > 0) {
      await db.cards.bulkDelete(idsToDelete);
      console.log(
        `[Electric→Dexie] Deleted ${idsToDelete.length} stale card(s)`
      );
    }

    // Add/update records from Electric
    if (electricData.length > 0) {
      await db.cards.bulkPut(electricData);
      console.log(`[Electric→Dexie] Synced ${electricData.length} card(s)`);
    }

    // Log final state
    if (idsToDelete.length === 0 && electricData.length === 0) {
      console.log(`[Electric→Dexie] Cards table cleared (0 rows)`);
    }
  });
}

// ============================================================================
// Query Hooks (Merged Layer: Synced + Local)
// ============================================================================

/**
 * Hook to get all cards (merged: synced + pending local changes)
 */
export function useCards() {
  const electricResult = cardsElectric.useCards();

  // Sync Electric data to Dexie
  // CRITICAL: Only sync after initial load to preserve cached data on page reload
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data !== undefined) {
      syncElectricToDexie(electricResult.data).catch((error) => {
        console.error(
          "[useCards] Failed to sync Electric data to Dexie:",
          error
        );
      });
    }
  }, [electricResult.isLoading, electricResult.data]);

  const mergedQuery = useQuery({
    queryKey: ["cards", "merged"],
    queryFn: async () => {
      return cardsMerged.getAllMergedCards();
    },
    staleTime: 0,
    placeholderData: [], // Show empty array while loading (prevents loading state)
  });

  // CRITICAL: Check isLoading to avoid cleanup on initial undefined state
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data) {
      cardsCleanup.cleanupSyncedCards(electricResult.data).then(() => {
        mergedQuery.refetch();
      });
    }
  }, [electricResult.isLoading, electricResult.data]);

  return {
    ...mergedQuery,
    isLoading: electricResult.isLoading || mergedQuery.isLoading,
  };
}

/**
 * Hook to get a single card by ID (merged)
 */
export function useCard(id: string | undefined) {
  const electricResult = cardsElectric.useCard(id);

  const mergedQuery = useQuery({
    queryKey: ["cards", "merged", id],
    queryFn: async () => {
      if (!id) return undefined;
      return cardsMerged.getMergedCard(id);
    },
    enabled: !!id,
    staleTime: 0,
  });

  useEffect(() => {
    if (electricResult.data && id) {
      mergedQuery.refetch();
    }
  }, [electricResult.data, id]);

  return mergedQuery;
}

/**
 * Hook to get cards for a document (merged)
 */
export function useCardsByDoc(sha256: string) {
  const electricResult = cardsElectric.useCardsByDoc(sha256);

  const mergedQuery = useQuery({
    queryKey: ["cards", "merged", "doc", sha256],
    queryFn: async () => {
      return cardsMerged.getMergedCardsByDoc(sha256);
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (electricResult.data) {
      mergedQuery.refetch();
    }
  }, [electricResult.data]);

  return mergedQuery;
}

/**
 * Hook to get cards for an annotation (merged)
 */
export function useCardsByAnnotation(annotationId: string) {
  const electricResult = cardsElectric.useCardsByAnnotation(annotationId);

  const mergedQuery = useQuery({
    queryKey: ["cards", "merged", "annotation", annotationId],
    queryFn: async () => {
      return cardsMerged.getMergedCardsByAnnotation(annotationId);
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (electricResult.data) {
      mergedQuery.refetch();
    }
  }, [electricResult.data]);

  return mergedQuery;
}

/**
 * Hook to get due cards (merged)
 */
export function useDueCards(nowMs: number) {
  const electricResult = cardsElectric.useDueCards(nowMs);

  const mergedQuery = useQuery({
    queryKey: ["cards", "merged", "due", nowMs],
    queryFn: async () => {
      return cardsMerged.getMergedDueCards(nowMs);
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (electricResult.data) {
      mergedQuery.refetch();
    }
  }, [electricResult.data]);

  return mergedQuery;
}

// ============================================================================
// Mutation Hooks (Local Layer: Optimistic Writes)
// ============================================================================

/**
 * Hook to create a new card (instant local write)
 */
export function useCreateCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Card, "id" | "created_ms">) => {
      return cardsLocal.createCardLocal(data);
    },
    onSuccess: (newCard: Card) => {
      console.log(
        `✅ [useCreateCard] Created card ${newCard.id} (pending sync)`
      );
      queryClient.invalidateQueries({ queryKey: ["cards", "merged"] });
    },
    onError: (error: Error) => {
      console.error("❌ [useCreateCard] Failed to create card:", error);
    },
  });
}

/**
 * Hook to update a card (instant local write)
 */
export function useUpdateCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Card, "id" | "created_ms">>;
    }) => {
      await cardsLocal.updateCardLocal(id, updates);
      return { id, updates };
    },
    onSuccess: ({ id }: { id: string }) => {
      console.log(`✅ [useUpdateCard] Updated card ${id} (pending sync)`);
      queryClient.invalidateQueries({ queryKey: ["cards", "merged"] });
    },
    onError: (error: Error) => {
      console.error("❌ [useUpdateCard] Failed to update card:", error);
    },
  });
}

/**
 * Hook to delete a card (instant local write)
 */
export function useDeleteCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await cardsLocal.deleteCardLocal(id);
      return id;
    },
    onSuccess: (id: string) => {
      console.log(`✅ [useDeleteCard] Deleted card ${id} (pending sync)`);
      queryClient.invalidateQueries({ queryKey: ["cards", "merged"] });
    },
    onError: (error: Error) => {
      console.error("❌ [useDeleteCard] Failed to delete card:", error);
    },
  });
}
