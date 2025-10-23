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
 * @param synced - Works from Electric (source of truth after sync)
 * @param local - Pending local changes from Dexie
 * @returns Merged array with local changes applied
 */
export function mergeWorks(
  synced: Work[],
  local: LocalWorkChange[]
): MergedWork[] {
  // Index local changes by work ID for O(1) lookup
  const localByWorkId = new Map<string, LocalWorkChange>();
  for (const change of local) {
    // Keep latest change per work (highest timestamp)
    const existing = localByWorkId.get(change.id);
    if (!existing || change._timestamp > existing._timestamp) {
      localByWorkId.set(change.id, change);
    }
  }

  const merged: MergedWork[] = [];
  const processedIds = new Set<string>();

  // 1. Apply local changes to synced works
  for (const syncedWork of synced) {
    const localChange = localByWorkId.get(syncedWork.id);
    processedIds.add(syncedWork.id);

    if (!localChange) {
      // No local changes - use synced data as-is
      merged.push(syncedWork);
      continue;
    }

    // Apply local change based on operation
    switch (localChange._op) {
      case "delete":
        // Local delete - filter out from merged results (silent)
        break;

      case "update":
        // Local update - merge local changes into synced data
        const updatedWork: MergedWork = {
          ...syncedWork,
          ...localChange.data, // Local changes override
          _local: {
            status: localChange._status,
            timestamp: localChange._timestamp,
            error: localChange._error,
          },
        };
        merged.push(updatedWork);
        break;

      case "insert":
        // Conflict: both local insert and synced data exist
        // This means sync completed - prefer synced data but mark as synced
        merged.push({
          ...syncedWork,
          _local: {
            status: "synced" as const,
            timestamp: localChange._timestamp,
          },
        });
        break;
    }
  }

  // 2. Add local inserts that haven't synced yet
  for (const [workId, localChange] of localByWorkId) {
    if (processedIds.has(workId)) continue; // Already processed above

    if (localChange._op === "insert" && localChange.data) {
      // Local insert pending sync - show in UI immediately
      const pendingWork: MergedWork = {
        ...localChange.data,
        _local: {
          status: localChange._status,
          timestamp: localChange._timestamp,
          error: localChange._error,
        },
      };
      merged.push(pendingWork);
    }
  }

  return merged;
}

/**
 * Get merged work by ID
 */
export async function getMergedWork(
  id: string
): Promise<MergedWork | undefined> {
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
}

/**
 * Get all merged works
 */
export async function getAllMergedWorks(): Promise<MergedWork[]> {
  const [synced, local] = await Promise.all([
    db.works.toArray(),
    db.works_local.toArray(),
  ]);

  return mergeWorks(synced, local);
}

/**
 * Get merged works filtered by type
 */
export async function getMergedWorksByType(
  workType: string
): Promise<MergedWork[]> {
  const [synced, local] = await Promise.all([
    db.works.where("workType").equals(workType).toArray(),
    db.works_local.toArray(), // Get all local changes (filter during merge)
  ]);

  // Merge all, then filter (in case local change modifies workType)
  const merged = mergeWorks(synced, local);
  return merged.filter((w) => w.workType === workType);
}

/**
 * Get merged favorite works
 */
export async function getMergedFavoriteWorks(): Promise<MergedWork[]> {
  const [synced, local] = await Promise.all([
    db.works.where("favorite").equals(1).toArray(), // Dexie uses 1/0 for booleans
    db.works_local.toArray(),
  ]);

  const merged = mergeWorks(synced, local);
  return merged.filter((w) => w.favorite === true);
}

/**
 * Search merged works by title (client-side)
 */
export async function searchMergedWorksByTitle(
  query: string
): Promise<MergedWork[]> {
  const allWorks = await getAllMergedWorks();
  const lowerQuery = query.toLowerCase();

  return allWorks.filter((w) => w.title.toLowerCase().includes(lowerQuery));
}
