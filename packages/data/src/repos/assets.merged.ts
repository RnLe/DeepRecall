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
 * @param synced - Assets from Electric (source of truth after sync)
 * @param local - Pending local changes from Dexie
 * @returns Merged array with local changes applied
 */
export function mergeAssets(
  synced: Asset[],
  local: LocalAssetChange[]
): MergedAsset[] {
  // Index local changes by asset ID for O(1) lookup
  const localByAssetId = new Map<string, LocalAssetChange>();
  for (const change of local) {
    // Keep latest change per asset (highest timestamp)
    const existing = localByAssetId.get(change.id);
    if (!existing || change._timestamp > existing._timestamp) {
      localByAssetId.set(change.id, change);
    }
  }

  const merged: MergedAsset[] = [];
  const processedIds = new Set<string>();

  // 1. Apply local changes to synced assets
  for (const syncedAsset of synced) {
    const localChange = localByAssetId.get(syncedAsset.id);
    processedIds.add(syncedAsset.id);

    if (!localChange) {
      // No local changes - use synced data as-is
      merged.push(syncedAsset);
      continue;
    }

    // Apply local change based on operation
    switch (localChange._op) {
      case "delete":
        // Local delete - filter out from merged results (silent)
        break;

      case "update":
        // Local update - merge local changes into synced data
        const updatedAsset: MergedAsset = {
          ...syncedAsset,
          ...localChange.data, // Local changes override
          _local: {
            status: localChange._status,
            timestamp: localChange._timestamp,
            error: localChange._error,
          },
        };
        merged.push(updatedAsset);
        break;

      case "insert":
        // Conflict: both local insert and synced data exist
        // This means sync completed - prefer synced data but mark as synced
        merged.push({
          ...syncedAsset,
          _local: {
            status: "synced" as const,
            timestamp: localChange._timestamp,
          },
        });
        break;
    }
  }

  // 2. Add local inserts that haven't synced yet
  for (const [assetId, localChange] of localByAssetId) {
    if (processedIds.has(assetId)) continue; // Already processed above

    if (localChange._op === "insert" && localChange.data) {
      // Local insert pending sync - show in UI immediately
      const pendingAsset: MergedAsset = {
        ...localChange.data,
        _local: {
          status: localChange._status,
          timestamp: localChange._timestamp,
          error: localChange._error,
        },
      };
      merged.push(pendingAsset);
    }
  }

  return merged;
}

/**
 * Get merged asset by ID
 */
export async function getMergedAsset(
  id: string
): Promise<MergedAsset | undefined> {
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
}

/**
 * Get all merged assets
 */
export async function getAllMergedAssets(): Promise<MergedAsset[]> {
  const [synced, local] = await Promise.all([
    db.assets.toArray(),
    db.assets_local.toArray(),
  ]);

  return mergeAssets(synced, local);
}

/**
 * Get merged assets filtered by work ID
 */
export async function getMergedAssetsByWork(
  workId: string
): Promise<MergedAsset[]> {
  const [synced, local] = await Promise.all([
    db.assets.where("workId").equals(workId).toArray(),
    db.assets_local.toArray(), // Get all local changes (filter during merge)
  ]);

  // Merge all, then filter (in case local change modifies workId)
  const merged = mergeAssets(synced, local);
  return merged.filter((a) => a.workId === workId);
}

/**
 * Get merged asset by hash (sha256)
 */
export async function getMergedAssetByHash(
  sha256: string
): Promise<MergedAsset | undefined> {
  const [synced, local] = await Promise.all([
    db.assets.where("sha256").equals(sha256).toArray(),
    db.assets_local.toArray(),
  ]);

  const merged = mergeAssets(synced, local);
  return merged.find((a) => a.sha256 === sha256);
}

/**
 * Get merged assets by annotation ID
 */
export async function getMergedAssetsByAnnotation(
  annotationId: string
): Promise<MergedAsset[]> {
  const [synced, local] = await Promise.all([
    db.assets.where("annotationId").equals(annotationId).toArray(),
    db.assets_local.toArray(),
  ]);

  const merged = mergeAssets(synced, local);
  return merged.filter((a) => a.annotationId === annotationId);
}
