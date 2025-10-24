/**
 * Merged repository for Author entities (Read Layer)
 * Combines synced data (Dexie authors) + local changes (authors_local)
 * Returns instant feedback with _local metadata for sync status
 */

import type { Author } from "@deeprecall/core";
import { db } from "../db";

export interface MergedAuthor extends Author {
  _local?: {
    op: "insert" | "update" | "delete";
    status: "pending" | "synced" | "error";
    timestamp: number;
  };
}

/**
 * Merge synced authors with local changes
 *
 * CRITICAL: Collects ALL updates per ID and applies sequentially (Pattern 2)
 * Fixes bug where only last update was applied before sync
 *
 * Rules:
 * - Local INSERT → Show immediately (pending)
 * - Local UPDATE → Apply ALL updates sequentially
 * - Local DELETE → Filter from results
 */
export async function mergeAuthors(
  synced: Author[],
  local: any[]
): Promise<MergedAuthor[]> {
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

  const result: MergedAuthor[] = [];
  const processedIds = new Set<string>();
  const syncedMap = new Map(synced.map((a) => [a.id, a]));

  // Phase 2: Process pending inserts (may have updates on top)
  for (const [id, insert] of pendingInserts) {
    if (pendingDeletes.has(id)) continue; // Deleted before sync

    processedIds.add(id);
    let mergedAuthor: MergedAuthor = {
      ...(insert.data as Author),
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
        mergedAuthor = {
          ...mergedAuthor,
          ...update.data,
          _local: {
            op: "update",
            status: update._status,
            timestamp: update._timestamp,
          },
        };
      }
    }

    result.push(mergedAuthor);
  }

  // Phase 3: Process synced items with updates
  for (const [id, updates] of pendingUpdates) {
    if (processedIds.has(id)) continue; // Already processed as insert
    if (pendingDeletes.has(id)) continue; // Deleted

    const syncedItem = syncedMap.get(id);
    if (syncedItem) {
      processedIds.add(id);
      let mergedAuthor: MergedAuthor = { ...syncedItem };

      // Apply ALL updates sequentially
      for (const update of updates) {
        mergedAuthor = {
          ...mergedAuthor,
          ...update.data,
          _local: {
            op: "update",
            status: update._status,
            timestamp: update._timestamp,
          },
        };
      }

      result.push(mergedAuthor);
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
 * Get all merged authors (synced + local)
 */
export async function getAllMergedAuthors(): Promise<MergedAuthor[]> {
  try {
    const synced = await db.authors.toArray();
    const local = await db.authors_local.toArray();
    return mergeAuthors(synced, local);
  } catch (error) {
    console.error("[getAllMergedAuthors] Error:", error);
    return []; // Always return array, never undefined
  }
}

/**
 * Get a single merged author by ID
 */
export async function getMergedAuthor(
  id: string
): Promise<MergedAuthor | undefined> {
  try {
    const synced = await db.authors.get(id);
    const local = await db.authors_local.where("id").equals(id).toArray();

    if (local.length === 0) {
      return synced; // No local changes
    }

    // Apply local changes
    const allAuthors = synced ? [synced] : [];
    const merged = await mergeAuthors(allAuthors, local);
    return merged[0];
  } catch (error) {
    console.error("[getMergedAuthor] Error:", error);
    return undefined;
  }
}

/**
 * Get multiple merged authors by IDs
 */
export async function getMergedAuthorsByIds(
  ids: string[]
): Promise<MergedAuthor[]> {
  try {
    const synced = await db.authors.where("id").anyOf(ids).toArray();
    const local = await db.authors_local.where("id").anyOf(ids).toArray();
    return mergeAuthors(synced, local);
  } catch (error) {
    console.error("[getMergedAuthorsByIds] Error:", error);
    return []; // Always return array, never undefined
  }
}

/**
 * Search merged authors by name (client-side filtering)
 */
export async function searchMergedAuthorsByName(
  query: string
): Promise<MergedAuthor[]> {
  try {
    const allAuthors = await getAllMergedAuthors();
    const lower = query.toLowerCase();
    return allAuthors.filter(
      (a) =>
        a.firstName.toLowerCase().includes(lower) ||
        a.lastName.toLowerCase().includes(lower)
    );
  } catch (error) {
    console.error("[searchMergedAuthorsByName] Error:", error);
    return []; // Always return array, never undefined
  }
}
