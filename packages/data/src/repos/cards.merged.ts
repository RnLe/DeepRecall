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
 *
 * CRITICAL: Collects ALL updates per ID and applies sequentially (Pattern 2)
 * Fixes bug where only last update was applied before sync
 *
 * Rules:
 * - Local INSERT → Show immediately (pending)
 * - Local UPDATE → Apply ALL updates sequentially
 * - Local DELETE → Filter from results
 */
export async function mergeCards(
  synced: Card[],
  local: any[]
): Promise<MergedCard[]> {
  // Phase 1: Collect changes by type and ID
  const pendingInserts = new Map<string, any>();
  const pendingUpdates = new Map<string, any[]>(); // Array to collect ALL updates
  const pendingDeletes = new Set<string>();

  for (const change of local) {
    if (change._op === "insert") {
      const existing = pendingInserts.get(change.id);
      if (!existing || change._timestamp > existing._timestamp) {
        pendingInserts.set(change.id, change);
      }
    } else if (change._op === "update") {
      // Collect ALL updates per ID (not just latest)
      if (!pendingUpdates.has(change.id)) {
        pendingUpdates.set(change.id, []);
      }
      pendingUpdates.get(change.id)!.push(change);
    } else if (change._op === "delete") {
      pendingDeletes.add(change.id);
    }
  }

  // Sort updates by timestamp for each ID
  for (const updates of pendingUpdates.values()) {
    updates.sort((a, b) => a._timestamp - b._timestamp);
  }

  const result: MergedCard[] = [];
  const processedIds = new Set<string>();
  const syncedMap = new Map(synced.map((c) => [c.id, c]));

  // Phase 2: Process pending inserts (may have updates on top)
  for (const [id, insert] of pendingInserts) {
    if (pendingDeletes.has(id)) continue; // Deleted before sync

    processedIds.add(id);
    let mergedCard: MergedCard = {
      ...(insert.data as Card),
      _local: {
        op: "insert",
        status: insert._status,
        timestamp: insert._timestamp,
      },
    };

    // Apply any updates that came after insert
    const updates = pendingUpdates.get(id);
    if (updates) {
      for (const update of updates) {
        mergedCard = {
          ...mergedCard,
          ...update.data,
          _local: {
            op: "update",
            status: update._status,
            timestamp: update._timestamp,
          },
        };
      }
    }

    result.push(mergedCard);
  }

  // Phase 3: Process synced items with updates
  for (const [id, updates] of pendingUpdates) {
    if (processedIds.has(id)) continue; // Already processed as insert
    if (pendingDeletes.has(id)) continue; // Deleted

    const syncedItem = syncedMap.get(id);
    if (syncedItem) {
      processedIds.add(id);
      let mergedCard: MergedCard = { ...syncedItem };

      // Apply ALL updates sequentially
      for (const update of updates) {
        mergedCard = {
          ...mergedCard,
          ...update.data,
          _local: {
            op: "update",
            status: update._status,
            timestamp: update._timestamp,
          },
        };
      }

      result.push(mergedCard);
    }
  }

  // Phase 4: Add synced items without local changes
  for (const syncedItem of synced) {
    if (processedIds.has(syncedItem.id)) continue; // Already processed
    if (pendingDeletes.has(syncedItem.id)) continue; // Deleted locally

    result.push(syncedItem);
  }

  return result;
}

/**
 * Get all merged cards (synced + local)
 */
export async function getAllMergedCards(): Promise<MergedCard[]> {
  try {
    const synced = await db.cards.toArray();
    const local = await db.cards_local.toArray();
    return mergeCards(synced, local);
  } catch (error) {
    console.error("[getAllMergedCards] Error:", error);
    return []; // Always return array, never undefined
  }
}

/**
 * Get a single merged card by ID
 */
export async function getMergedCard(
  id: string
): Promise<MergedCard | undefined> {
  try {
    const synced = await db.cards.get(id);
    const local = await db.cards_local.where("id").equals(id).toArray();

    if (local.length === 0) {
      return synced; // No local changes
    }

    // Apply local changes
    const allCards = synced ? [synced] : [];
    const merged = await mergeCards(allCards, local);
    return merged[0];
  } catch (error) {
    console.error("[getMergedCard] Error:", error);
    return undefined;
  }
}

/**
 * Get merged cards for a document
 */
export async function getMergedCardsByDoc(
  sha256: string
): Promise<MergedCard[]> {
  try {
    const synced = await db.cards.where("sha256").equals(sha256).toArray();
    const local = await db.cards_local.toArray();
    const merged = await mergeCards(synced, local);
    // Filter to this document only
    return merged.filter((c) => c.sha256 === sha256);
  } catch (error) {
    console.error("[getMergedCardsByDoc] Error:", error);
    return []; // Always return array, never undefined
  }
}

/**
 * Get merged cards for an annotation
 */
export async function getMergedCardsByAnnotation(
  annotationId: string
): Promise<MergedCard[]> {
  try {
    const synced = await db.cards
      .where("annotation_id")
      .equals(annotationId)
      .toArray();
    const local = await db.cards_local.toArray();
    const merged = await mergeCards(synced, local);
    // Filter to this annotation only
    return merged.filter((c) => c.annotation_id === annotationId);
  } catch (error) {
    console.error("[getMergedCardsByAnnotation] Error:", error);
    return []; // Always return array, never undefined
  }
}

/**
 * Get merged cards that are due for review
 */
export async function getMergedDueCards(nowMs: number): Promise<MergedCard[]> {
  try {
    const synced = await db.cards.where("due").belowOrEqual(nowMs).toArray();
    const local = await db.cards_local.toArray();
    const merged = await mergeCards(synced, local);
    // Filter to due cards only
    return merged.filter((c) => c.due <= nowMs);
  } catch (error) {
    console.error("[getMergedDueCards] Error:", error);
    return []; // Always return array, never undefined
  }
}
