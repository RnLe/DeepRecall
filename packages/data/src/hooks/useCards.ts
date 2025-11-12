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
import { logger } from "@deeprecall/telemetry";

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
      logger.info("sync.electric", "Deleted stale cards from Dexie", {
        count: idsToDelete.length,
        ids: idsToDelete,
      });
    }

    // Add/update records from Electric
    if (electricData.length > 0) {
      await db.cards.bulkPut(electricData);
      logger.info("sync.electric", "Synced cards from Electric to Dexie", {
        count: electricData.length,
      });
    }

    // Log final state
    if (idsToDelete.length === 0 && electricData.length === 0) {
      logger.info("sync.electric", "Cards table cleared", { count: 0 });
    }
  });
}

// ============================================================================
// Sync Hook (Internal: Called ONLY by SyncManager)
// ============================================================================

/**
 * Internal sync hook - subscribes to Electric and syncs to Dexie
 * MUST be called exactly once by SyncManager to avoid race conditions
 * DO NOT call from components - use useCards() instead
 * @param userId - Filter cards by owner_id (multi-tenant isolation)
 */
export function useCardsSync(userId?: string) {
  const electricResult = cardsElectric.useCards(userId);
  const queryClient = useQueryClient();

  // Sync Electric data to Dexie
  useEffect(() => {
    if (
      !electricResult.isLoading &&
      electricResult.data !== undefined
      // Note: Sync even with stale cache data - having stale data is better than no data
    ) {
      syncElectricToDexie(electricResult.data)
        .then(() => {
          // Invalidate all cards queries to trigger cross-device updates
          queryClient.invalidateQueries({ queryKey: ["cards"] });
        })
        .catch((error) => {
          logger.error("sync.electric", "Failed to sync cards to Dexie", {
            error: error.message,
          });
        });
    }
  }, [electricResult.data, electricResult.isFreshData, queryClient]);

  // Cleanup synced cards
  useEffect(() => {
    if (
      !electricResult.isLoading &&
      electricResult.data
      // Cleanup even with stale data - if Electric has these IDs, local changes should be removed
    ) {
      cardsCleanup.cleanupSyncedCards(electricResult.data);
    }
  }, [
    electricResult.isLoading,
    electricResult.data,
    electricResult.isFreshData,
  ]);

  return null;
}

// ============================================================================
// Query Hooks (Merged Layer: Synced + Local)
// ============================================================================

/**
 * Hook to get all cards (merged: synced + pending local changes)
 * Read-only - queries Dexie merged view without side effects
 */
export function useCards() {
  return useQuery({
    queryKey: ["cards", "merged"],
    queryFn: async () => {
      return cardsMerged.getAllMergedCards();
    },
    staleTime: 0,
    placeholderData: [], // Show empty array while loading (prevents loading state)
  });
}

/**
 * Hook to get a single card by ID (merged)
 * Read-only - queries Dexie merged view without side effects
 */
export function useCard(id: string | undefined) {
  return useQuery({
    queryKey: ["cards", "merged", id],
    queryFn: async () => {
      if (!id) return undefined;
      return cardsMerged.getMergedCard(id);
    },
    enabled: !!id,
    staleTime: 0,
  });
}

/**
 * Hook to get cards for a document (merged)
 * Read-only - queries Dexie merged view without side effects
 */
export function useCardsByDoc(sha256: string) {
  return useQuery({
    queryKey: ["cards", "merged", "doc", sha256],
    queryFn: async () => {
      return cardsMerged.getMergedCardsByDoc(sha256);
    },
    staleTime: 0,
  });
}

/**
 * Hook to get cards for an annotation (merged)
 * Read-only - queries Dexie merged view without side effects
 */
export function useCardsByAnnotation(annotationId: string) {
  return useQuery({
    queryKey: ["cards", "merged", "annotation", annotationId],
    queryFn: async () => {
      return cardsMerged.getMergedCardsByAnnotation(annotationId);
    },
    staleTime: 0,
  });
}

/**
 * Hook to get due cards (merged)
 * Read-only - queries Dexie merged view without side effects
 */
export function useDueCards(nowMs: number) {
  return useQuery({
    queryKey: ["cards", "merged", "due", nowMs],
    queryFn: async () => {
      return cardsMerged.getMergedDueCards(nowMs);
    },
    staleTime: 0,
  });
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
      logger.info("db.local", "Created card locally (pending sync)", {
        cardId: newCard.id,
      });
      queryClient.invalidateQueries({ queryKey: ["cards", "merged"] });
    },
    onError: (error: Error) => {
      logger.error("db.local", "Failed to create card", {
        error: error.message,
      });
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
      logger.info("db.local", "Updated card locally (pending sync)", {
        cardId: id,
      });
      queryClient.invalidateQueries({ queryKey: ["cards", "merged"] });
    },
    onError: (error: Error) => {
      logger.error("db.local", "Failed to update card", {
        error: error.message,
      });
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
      logger.info("db.local", "Deleted card locally (pending sync)", {
        cardId: id,
      });
      queryClient.invalidateQueries({ queryKey: ["cards", "merged"] });
    },
    onError: (error: Error) => {
      logger.error("db.local", "Failed to delete card", {
        error: error.message,
      });
    },
  });
}
