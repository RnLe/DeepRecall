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
 * Rules:
 * - Local INSERT → Show immediately (pending)
 * - Local UPDATE → Override synced data
 * - Local DELETE → Filter from results
 */
export async function mergeCollections(
  synced: Collection[],
  local: any[]
): Promise<MergedCollection[]> {
  const syncedMap = new Map(synced.map((c) => [c.id, c]));
  const result: MergedCollection[] = [];

  // Process local changes
  for (const localChange of local) {
    if (localChange._op === "insert") {
      // New collection (not yet synced)
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
      // Updated collection (override synced)
      const syncedCollection = syncedMap.get(localChange.id);
      if (syncedCollection) {
        result.push({
          ...syncedCollection,
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
      // Deleted collection (filter out)
      syncedMap.delete(localChange.id);
    }
  }

  // Add remaining synced collections (no local changes)
  for (const syncedCollection of syncedMap.values()) {
    result.push(syncedCollection);
  }

  return result;
}

/**
 * Get all merged collections (synced + local)
 */
export async function getAllMergedCollections(): Promise<MergedCollection[]> {
  const synced = await db.collections.toArray();
  const local = await db.collections_local.toArray();
  return mergeCollections(synced, local);
}

/**
 * Get a single merged collection by ID
 */
export async function getMergedCollection(
  id: string
): Promise<MergedCollection | undefined> {
  const synced = await db.collections.get(id);
  const local = await db.collections_local.where("id").equals(id).toArray();

  if (local.length === 0) {
    return synced; // No local changes
  }

  // Apply local changes
  const allCollections = synced ? [synced] : [];
  const merged = await mergeCollections(allCollections, local);
  return merged[0];
}

/**
 * Get merged public collections (isPrivate = false)
 */
export async function getMergedPublicCollections(): Promise<
  MergedCollection[]
> {
  const allCollections = await getAllMergedCollections();
  return allCollections.filter((c) => !c.isPrivate);
}
