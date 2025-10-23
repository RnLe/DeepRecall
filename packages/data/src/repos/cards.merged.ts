/**
 * Merged repository for Card entities (Read Layer)
 * Combines synced data (Dexie cards) + local changes (cards_local)
 * Returns instant feedback with _local metadata for sync status
 */

import type { Card } from "@deeprecall/core";
import { db } from "../db";

export interface MergedCard extends Card {
  _local?: {
    op: "insert" | "update" | "delete";
    status: "pending" | "synced" | "error";
    timestamp: number;
  };
}

/**
 * Merge synced cards with local changes
 * Rules:
 * - Local INSERT → Show immediately (pending)
 * - Local UPDATE → Override synced data
 * - Local DELETE → Filter from results
 */
export async function mergeCards(
  synced: Card[],
  local: any[]
): Promise<MergedCard[]> {
  const syncedMap = new Map(synced.map((c) => [c.id, c]));
  const result: MergedCard[] = [];

  // Process local changes
  for (const localChange of local) {
    if (localChange._op === "insert") {
      // New card (not yet synced)
      result.push({
        ...localChange.data,
        _local: {
          op: "insert",
          status: localChange._status,
          timestamp: localChange._timestamp,
        },
      });
      syncedMap.delete(localChange.id); // Don't duplicate
    } else if (localChange._op === "update") {
      // Updated card (override synced)
      const syncedCard = syncedMap.get(localChange.id);
      if (syncedCard) {
        result.push({
          ...syncedCard,
          ...localChange.data,
          _local: {
            op: "update",
            status: localChange._status,
            timestamp: localChange._timestamp,
          },
        });
        syncedMap.delete(localChange.id); // Don't duplicate
      }
    } else if (localChange._op === "delete") {
      // Deleted card (filter out)
      syncedMap.delete(localChange.id);
    }
  }

  // Add remaining synced cards (no local changes)
  for (const syncedCard of syncedMap.values()) {
    result.push(syncedCard);
  }

  return result;
}

/**
 * Get all merged cards (synced + local)
 */
export async function getAllMergedCards(): Promise<MergedCard[]> {
  const synced = await db.cards.toArray();
  const local = await db.cards_local.toArray();
  return mergeCards(synced, local);
}

/**
 * Get a single merged card by ID
 */
export async function getMergedCard(
  id: string
): Promise<MergedCard | undefined> {
  const synced = await db.cards.get(id);
  const local = await db.cards_local.where("id").equals(id).toArray();

  if (local.length === 0) {
    return synced; // No local changes
  }

  // Apply local changes
  const allCards = synced ? [synced] : [];
  const merged = await mergeCards(allCards, local);
  return merged[0];
}

/**
 * Get merged cards for a document
 */
export async function getMergedCardsByDoc(
  sha256: string
): Promise<MergedCard[]> {
  const synced = await db.cards.where("sha256").equals(sha256).toArray();
  const local = await db.cards_local.toArray();
  const merged = await mergeCards(synced, local);
  // Filter to this document only
  return merged.filter((c) => c.sha256 === sha256);
}

/**
 * Get merged cards for an annotation
 */
export async function getMergedCardsByAnnotation(
  annotationId: string
): Promise<MergedCard[]> {
  const synced = await db.cards
    .where("annotation_id")
    .equals(annotationId)
    .toArray();
  const local = await db.cards_local.toArray();
  const merged = await mergeCards(synced, local);
  // Filter to this annotation only
  return merged.filter((c) => c.annotation_id === annotationId);
}

/**
 * Get merged cards that are due for review
 */
export async function getMergedDueCards(nowMs: number): Promise<MergedCard[]> {
  const synced = await db.cards.where("due").belowOrEqual(nowMs).toArray();
  const local = await db.cards_local.toArray();
  const merged = await mergeCards(synced, local);
  // Filter to due cards only
  return merged.filter((c) => c.due <= nowMs);
}
