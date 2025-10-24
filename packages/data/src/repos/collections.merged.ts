/**
 * Merged repository for Collection entities (Read Layer)
 * Combines synced data (Dexie collections) + local changes (collections_local)
 * Returns instant feedback with _local metadata for sync status
 */

import type { Collection } from "@deeprecall/core";
import { db } from "../db";

export interface MergedCollection extends Collection {
  _local?: {
    op: "insert" | "update" | "delete";
    status: "pending" | "synced" | "error";
    timestamp: number;
  };
}

/**
 * Merge synced collections with local changes
 *
 * CRITICAL: Collects ALL updates per ID and applies sequentially (Pattern 2)
 * Fixes bug where only last update was applied before sync
 *
 * Rules:
 * - Local INSERT → Show immediately (pending)
 * - Local UPDATE → Apply ALL updates sequentially
 * - Local DELETE → Filter from results
 */
export async function mergeCollections(
  synced: Collection[],
  local: any[]
): Promise<MergedCollection[]> {
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

  const result: MergedCollection[] = [];
  const processedIds = new Set<string>();
  const syncedMap = new Map(synced.map((c) => [c.id, c]));

  // Phase 2: Process pending inserts (may have updates on top)
  for (const [id, insert] of pendingInserts) {
    if (pendingDeletes.has(id)) continue; // Deleted before sync

    processedIds.add(id);
    let mergedCollection: MergedCollection = {
      ...(insert.data as Collection),
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
        mergedCollection = {
          ...mergedCollection,
          ...update.data,
          _local: {
            op: "update",
            status: update._status,
            timestamp: update._timestamp,
          },
        };
      }
    }

    result.push(mergedCollection);
  }

  // Phase 3: Process synced items with updates
  for (const [id, updates] of pendingUpdates) {
    if (processedIds.has(id)) continue; // Already processed as insert
    if (pendingDeletes.has(id)) continue; // Deleted

    const syncedItem = syncedMap.get(id);
    if (syncedItem) {
      processedIds.add(id);
      let mergedCollection: MergedCollection = { ...syncedItem };

      // Apply ALL updates sequentially
      for (const update of updates) {
        mergedCollection = {
          ...mergedCollection,
          ...update.data,
          _local: {
            op: "update",
            status: update._status,
            timestamp: update._timestamp,
          },
        };
      }

      result.push(mergedCollection);
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
 * Get all merged collections (synced + local)
 */
export async function getAllMergedCollections(): Promise<MergedCollection[]> {
  try {
    const synced = await db.collections.toArray();
    const local = await db.collections_local.toArray();
    return mergeCollections(synced, local);
  } catch (error) {
    console.error("[getAllMergedCollections] Error:", error);
    return []; // Always return array, never undefined
  }
}

/**
 * Get a single merged collection by ID
 */
export async function getMergedCollection(
  id: string
): Promise<MergedCollection | undefined> {
  try {
    const synced = await db.collections.get(id);
    const local = await db.collections_local.where("id").equals(id).toArray();

    if (local.length === 0) {
      return synced; // No local changes
    }

    // Apply local changes
    const allCollections = synced ? [synced] : [];
    const merged = await mergeCollections(allCollections, local);
    return merged[0];
  } catch (error) {
    console.error("[getMergedCollection] Error:", error);
    return undefined;
  }
}

/**
 * Get merged public collections (isPrivate = false)
 */
export async function getMergedPublicCollections(): Promise<
  MergedCollection[]
> {
  try {
    const allCollections = await getAllMergedCollections();
    return allCollections.filter((c) => !c.isPrivate);
  } catch (error) {
    console.error("[getMergedPublicCollections] Error:", error);
    return []; // Always return array, never undefined
  }
}
