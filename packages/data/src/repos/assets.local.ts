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
import { logger } from "@deeprecall/telemetry";
import { isAuthenticated } from "../auth";

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

  // 2. Enqueue for background sync (only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "assets",
      op: "insert",
      payload: asset,
    });
  }

  logger.info("db.local", "Created asset (pending sync)", {
    assetId: asset.id,
    workId: asset.workId,
    willSync: isAuthenticated(),
  });
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

  // 2. Enqueue for background sync (only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "assets",
      op: "update",
      payload: { id, ...updatedData },
    });
  }

  logger.info("db.local", "Updated asset (pending sync)", {
    assetId: id,
    fields: Object.keys(updates),
    willSync: isAuthenticated(),
  });
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

  // 2. Enqueue for background sync (only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "assets",
      op: "delete",
      payload: { id },
    });
  }

  logger.info("db.local", "Deleted asset (pending sync)", {
    assetId: id,
    willSync: isAuthenticated(),
  });
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
  logger.debug("db.local", "Cleaned up synced asset", {
    assetId: id,
    willSync: isAuthenticated(),
  });
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
  logger.warn("db.local", "Asset sync failed", { assetId: id, error });
}
