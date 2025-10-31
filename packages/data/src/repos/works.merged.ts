/**
 * Works Merged Repository (Merge Layer)
 *
 * Combines synced data from Electric with pending local changes
 * for a consistent view across the UI.
 *
 * Responsibilities:
 * - Merge works (synced) + works_local (pending)
 * - Apply conflict resolution rules
 * - Provide single source of truth for UI
 *
 * Merge Rules:
 * 1. Local INSERT: Show local work immediately (pending sync)
 * 2. Local UPDATE: Override synced data with local changes
 * 3. Local DELETE: Filter out from synced data
 * 4. Sync conflicts: Local wins (user's latest intent)
 */

import { db } from "../db";
import type { Work } from "@deeprecall/core";
import { logger } from "@deeprecall/telemetry";
import type { LocalWorkChange } from "./works.local";

/**
 * Merged work with sync status metadata
 */
export interface MergedWork extends Work {
  _local?: {
    status: "pending" | "syncing" | "synced" | "error";
    timestamp: number;
    error?: string;
  };
}

/**
 * Merge synced works with local pending changes
 *
 * CRITICAL: Collects ALL updates per ID and applies them sequentially
 * (not just the latest) to handle rapid successive updates correctly.
 *
 * @param synced - Works from Electric (source of truth after sync)
 * @param local - Pending local changes from Dexie
 * @returns Merged array with local changes applied
 */
export function mergeWorks(
  synced: Work[],
  local: LocalWorkChange[]
): MergedWork[] {
  // Phase 1: Collect ALL changes by type (not just latest!)
  const pendingInserts = new Map<string, LocalWorkChange>();
  const pendingUpdates = new Map<string, LocalWorkChange[]>(); // Array per ID!
  const pendingDeletes = new Set<string>();

  for (const change of local) {
    if (change._op === "insert") {
      // For inserts, keep latest by timestamp
      const existing = pendingInserts.get(change.id);
      if (!existing || change._timestamp > existing._timestamp) {
        pendingInserts.set(change.id, change);
      }
    } else if (change._op === "update") {
      // For updates, collect ALL in array (apply sequentially later)
      if (!pendingUpdates.has(change.id)) {
        pendingUpdates.set(change.id, []);
      }
      pendingUpdates.get(change.id)!.push(change);
    } else if (change._op === "delete") {
      // For deletes, just track the ID
      pendingDeletes.add(change.id);
    }
  }

  // Sort each update array by timestamp to apply in order
  for (const updates of pendingUpdates.values()) {
    updates.sort((a, b) => a._timestamp - b._timestamp);
  }

  const merged: MergedWork[] = [];
  const processedIds = new Set<string>();

  // Phase 2: Process pending inserts (which may also have updates)
  for (const [id, insert] of pendingInserts) {
    if (pendingDeletes.has(id)) {
      // Insert then delete - skip entirely
      processedIds.add(id);
      continue;
    }

    let mergedWork: MergedWork = {
      ...insert.data!,
      _local: {
        status: insert._status,
        timestamp: insert._timestamp,
        error: insert._error,
      },
    };

    // Apply any updates to this insert
    const updates = pendingUpdates.get(id);
    if (updates) {
      for (const update of updates) {
        mergedWork = {
          ...mergedWork,
          ...update.data,
          _local: {
            status: update._status,
            timestamp: update._timestamp,
            error: update._error,
          },
        };
      }
    }

    merged.push(mergedWork);
    processedIds.add(id);
  }

  // Phase 3: Process synced works (with potential updates or deletes)
  for (const syncedWork of synced) {
    if (processedIds.has(syncedWork.id)) {
      // Already processed as pending insert
      continue;
    }

    if (pendingDeletes.has(syncedWork.id)) {
      // Local delete - filter out
      processedIds.add(syncedWork.id);
      continue;
    }

    // Check for updates
    const updates = pendingUpdates.get(syncedWork.id);
    if (!updates || updates.length === 0) {
      // No updates - use synced data as-is
      merged.push(syncedWork);
      processedIds.add(syncedWork.id);
      continue;
    }

    // Apply ALL updates sequentially
    let mergedWork: MergedWork = { ...syncedWork };
    for (const update of updates) {
      mergedWork = {
        ...mergedWork,
        ...update.data,
        _local: {
          status: update._status,
          timestamp: update._timestamp,
          error: update._error,
        },
      };
    }

    merged.push(mergedWork);
    processedIds.add(syncedWork.id);
  }

  return merged;
}

/**
 * Get merged work by ID
 */
export async function getMergedWork(
  id: string
): Promise<MergedWork | undefined> {
  try {
    // Get synced work
    const synced = await db.works.get(id);

    // Get local changes for this work
    const localChanges = await db.works_local.where("id").equals(id).toArray();

    if (!synced && localChanges.length === 0) {
      return undefined;
    }

    // Merge single work
    const merged = mergeWorks(synced ? [synced] : [], localChanges);

    return merged[0];
  } catch (error) {
    logger.error("db.local", "Failed to get merged work", {
      workId: id,
      error: String(error),
    });
    return undefined; // Always return valid type
  }
}

/**
 * Get all merged works
 */
export async function getAllMergedWorks(): Promise<MergedWork[]> {
  try {
    const [synced, local] = await Promise.all([
      db.works.toArray(),
      db.works_local.toArray(),
    ]);

    return mergeWorks(synced, local);
  } catch (error) {
    logger.error("db.local", "Failed to get all merged works", {
      error: String(error),
    });
    return []; // Always return array, never undefined
  }
}

/**
 * Get merged works filtered by type
 */
export async function getMergedWorksByType(
  workType: string
): Promise<MergedWork[]> {
  try {
    const [synced, local] = await Promise.all([
      db.works.where("workType").equals(workType).toArray(),
      db.works_local.toArray(), // Get all local changes (filter during merge)
    ]);

    // Merge all, then filter (in case local change modifies workType)
    const merged = mergeWorks(synced, local);
    return merged.filter((w) => w.workType === workType);
  } catch (error) {
    logger.error("db.local", "Failed to get merged works by type", {
      workType,
      error: String(error),
    });
    return []; // Always return array, never undefined
  }
}

/**
 * Get merged favorite works
 */
export async function getMergedFavoriteWorks(): Promise<MergedWork[]> {
  try {
    const [synced, local] = await Promise.all([
      db.works.where("favorite").equals(1).toArray(), // Dexie uses 1/0 for booleans
      db.works_local.toArray(),
    ]);

    const merged = mergeWorks(synced, local);
    return merged.filter((w) => w.favorite === true);
  } catch (error) {
    logger.error("db.local", "Failed to get merged favorite works", {
      error: String(error),
    });
    return []; // Always return array, never undefined
  }
}

/**
 * Search merged works by title (client-side)
 */
export async function searchMergedWorksByTitle(
  query: string
): Promise<MergedWork[]> {
  try {
    const allWorks = await getAllMergedWorks();
    const lowerQuery = query.toLowerCase();

    return allWorks.filter((w) => w.title.toLowerCase().includes(lowerQuery));
  } catch (error) {
    logger.error("db.local", "Failed to search merged works by title", {
      query,
      error: String(error),
    });
    return []; // Always return array, never undefined
  }
}
