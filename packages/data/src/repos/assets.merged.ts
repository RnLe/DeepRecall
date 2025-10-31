/**
 * Assets Merged Repository (Merge Layer)
 *
 * Combines synced data from Electric with pending local changes
 * for a consistent view across the UI.
 *
 * Responsibilities:
 * - Merge assets (synced) + assets_local (pending)
 * - Apply conflict resolution rules
 * - Provide single source of truth for UI
 *
 * Merge Rules:
 * 1. Local INSERT: Show local asset immediately (pending sync)
 * 2. Local UPDATE: Override synced data with local changes
 * 3. Local DELETE: Filter out from synced data
 * 4. Sync conflicts: Local wins (user's latest intent)
 */

import { db } from "../db";
import type { Asset } from "@deeprecall/core";
import type { LocalAssetChange } from "./assets.local";
import { logger } from "@deeprecall/telemetry";

/**
 * Merged asset with sync status metadata
 */
export interface MergedAsset extends Asset {
  _local?: {
    status: "pending" | "syncing" | "synced" | "error";
    timestamp: number;
    error?: string;
  };
}

/**
 * Merge synced assets with local pending changes
 *
 * CRITICAL: Collects ALL updates per ID and applies them sequentially
 * (not just the latest) to handle rapid successive updates correctly.
 *
 * @param synced - Assets from Electric (source of truth after sync)
 * @param local - Pending local changes from Dexie
 * @returns Merged array with local changes applied
 */
export function mergeAssets(
  synced: Asset[],
  local: LocalAssetChange[]
): MergedAsset[] {
  // Phase 1: Collect ALL changes by type (not just latest!)
  const pendingInserts = new Map<string, LocalAssetChange>();
  const pendingUpdates = new Map<string, LocalAssetChange[]>(); // Array per ID!
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

  const merged: MergedAsset[] = [];
  const processedIds = new Set<string>();

  // Phase 2: Process pending inserts (which may also have updates)
  for (const [id, insert] of pendingInserts) {
    if (pendingDeletes.has(id)) {
      // Insert then delete - skip entirely
      processedIds.add(id);
      continue;
    }

    let mergedAsset: MergedAsset = {
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
        mergedAsset = {
          ...mergedAsset,
          ...update.data,
          _local: {
            status: update._status,
            timestamp: update._timestamp,
            error: update._error,
          },
        };
      }
    }

    merged.push(mergedAsset);
    processedIds.add(id);
  }

  // Phase 3: Process synced assets (with potential updates or deletes)
  for (const syncedAsset of synced) {
    if (processedIds.has(syncedAsset.id)) {
      // Already processed as pending insert
      continue;
    }

    if (pendingDeletes.has(syncedAsset.id)) {
      // Local delete - filter out
      processedIds.add(syncedAsset.id);
      continue;
    }

    // Check for updates
    const updates = pendingUpdates.get(syncedAsset.id);
    if (!updates || updates.length === 0) {
      // No updates - use synced data as-is
      merged.push(syncedAsset);
      processedIds.add(syncedAsset.id);
      continue;
    }

    // Apply ALL updates sequentially
    let mergedAsset: MergedAsset = { ...syncedAsset };
    for (const update of updates) {
      mergedAsset = {
        ...mergedAsset,
        ...update.data,
        _local: {
          status: update._status,
          timestamp: update._timestamp,
          error: update._error,
        },
      };
    }

    merged.push(mergedAsset);
    processedIds.add(syncedAsset.id);
  }

  return merged;
}

/**
 * Get merged asset by ID
 */
export async function getMergedAsset(
  id: string
): Promise<MergedAsset | undefined> {
  try {
    // Get synced asset
    const synced = await db.assets.get(id);

    // Get local changes for this asset
    const localChanges = await db.assets_local.where("id").equals(id).toArray();

    if (!synced && localChanges.length === 0) {
      return undefined;
    }

    // Merge single asset
    const merged = mergeAssets(synced ? [synced] : [], localChanges);

    return merged[0];
  } catch (error) {
    logger.error("db.local", "Failed to get merged asset", {
      assetId: id,
      error: String(error),
    });
    return undefined; // Always return valid type
  }
}

/**
 * Get all merged assets
 */
export async function getAllMergedAssets(): Promise<MergedAsset[]> {
  try {
    const [synced, local] = await Promise.all([
      db.assets.toArray(),
      db.assets_local.toArray(),
    ]);

    return mergeAssets(synced, local);
  } catch (error) {
    logger.error("db.local", "Failed to get all merged assets", {
      error: String(error),
    });
    return []; // Always return array, never undefined
  }
}

/**
 * Get merged assets filtered by work ID
 */
export async function getMergedAssetsByWork(
  workId: string
): Promise<MergedAsset[]> {
  try {
    const [synced, local] = await Promise.all([
      db.assets.where("workId").equals(workId).toArray(),
      db.assets_local.toArray(), // Get all local changes (filter during merge)
    ]);

    // Merge all, then filter (in case local change modifies workId)
    const merged = mergeAssets(synced, local);
    return merged.filter((a) => a.workId === workId);
  } catch (error) {
    logger.error("db.local", "Failed to get merged assets by work", {
      workId,
      error: String(error),
    });
    return []; // Always return array, never undefined
  }
}

/**
 * Get merged asset by hash (sha256)
 */
export async function getMergedAssetByHash(
  sha256: string
): Promise<MergedAsset | undefined> {
  try {
    const [synced, local] = await Promise.all([
      db.assets.where("sha256").equals(sha256).toArray(),
      db.assets_local.toArray(),
    ]);

    const merged = mergeAssets(synced, local);
    return merged.find((a) => a.sha256 === sha256);
  } catch (error) {
    logger.error("db.local", "Failed to get merged asset by hash", {
      sha256,
      error: String(error),
    });
    return undefined; // Always return valid type
  }
}

/**
 * Get merged assets by annotation ID
 */
export async function getMergedAssetsByAnnotation(
  annotationId: string
): Promise<MergedAsset[]> {
  try {
    const [synced, local] = await Promise.all([
      db.assets.where("annotationId").equals(annotationId).toArray(),
      db.assets_local.toArray(),
    ]);

    const merged = mergeAssets(synced, local);
    return merged.filter((a) => a.annotationId === annotationId);
  } catch (error) {
    logger.error("db.local", "Failed to get merged assets by annotation", {
      annotationId,
      error: String(error),
    });
    return []; // Always return array, never undefined
  }
}
