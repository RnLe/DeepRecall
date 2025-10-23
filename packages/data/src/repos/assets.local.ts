/**
 * Assets Local Repository (Optimistic Layer)
 *
 * Handles immediate local writes for instant UI feedback.
 * Changes are stored in Dexie and enqueued for background sync.
 *
 * Responsibilities:
 * - Write to assets_local table (instant)
 * - Enqueue changes to WriteBuffer (background sync)
 * - Track sync status (_status, _timestamp)
 */

import { db } from "../db";
import { AssetSchema, type Asset } from "@deeprecall/core";
import { createWriteBuffer } from "../writeBuffer";
import { v4 as uuidv4 } from "uuid";

/**
 * Local change record with sync metadata
 */
export interface LocalAssetChange {
  _localId?: number; // Dexie auto-increment
  id: string; // Asset ID
  _op: "insert" | "update" | "delete";
  _status: "pending" | "syncing" | "synced" | "error";
  _timestamp: number; // Local timestamp
  _error?: string; // Error message if sync failed

  // Asset data (for insert/update)
  data?: Asset;
}

const buffer = createWriteBuffer();

/**
 * Create a new asset locally (optimistic)
 * Writes to local Dexie immediately, enqueues for sync
 */
export async function createAssetLocal(
  data: Omit<Asset, "id" | "kind" | "createdAt" | "updatedAt">
): Promise<Asset> {
  const asset: Asset = AssetSchema.parse({
    ...data,
    id: uuidv4(),
    kind: "asset",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 1. Write to local Dexie (instant)
  await db.assets_local.add({
    id: asset.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: asset,
  });

  // 2. Enqueue for background sync
  await buffer.enqueue({
    table: "assets",
    op: "insert",
    payload: asset,
  });

  console.log(`[Local] Created asset ${asset.id} (pending sync)`);
  return asset;
}

/**
 * Update an asset locally (optimistic)
 */
export async function updateAssetLocal(
  id: string,
  updates: Partial<Asset>
): Promise<void> {
  const updatedData = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // 1. Update/add to local Dexie
  await db.assets_local.put({
    id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: updatedData as any, // Partial data for update
  });

  // 2. Enqueue for background sync
  await buffer.enqueue({
    table: "assets",
    op: "update",
    payload: { id, ...updatedData },
  });

  console.log(`[Local] Updated asset ${id} (pending sync)`);
}

/**
 * Delete an asset locally (optimistic)
 */
export async function deleteAssetLocal(id: string): Promise<void> {
  // 1. Mark as deleted in local Dexie
  await db.assets_local.put({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
  });

  // 2. Enqueue for background sync
  await buffer.enqueue({
    table: "assets",
    op: "delete",
    payload: { id },
  });

  console.log(`[Local] Deleted asset ${id} (pending sync)`);
}

/**
 * Get all local pending changes
 */
export async function getLocalAssetChanges(): Promise<LocalAssetChange[]> {
  return db.assets_local.toArray();
}

/**
 * Mark a local change as synced and remove it
 */
export async function markAssetSynced(id: string): Promise<void> {
  await db.assets_local.where("id").equals(id).delete();
  console.log(`[Local] Cleaned up synced asset ${id}`);
}

/**
 * Mark a local change as failed
 */
export async function markAssetSyncFailed(
  id: string,
  error: string
): Promise<void> {
  await db.assets_local.where("id").equals(id).modify({
    _status: "error",
    _error: error,
  });
  console.warn(`[Local] Asset ${id} sync failed: ${error}`);
}
