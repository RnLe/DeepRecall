/**
 * Presets Local Repository (Optimistic Layer)
 *
 * Handles immediate local writes for instant UI feedback.
 * Changes are stored in Dexie and enqueued for background sync.
 *
 * Responsibilities:
 * - Write to presets_local table (instant)
 * - Enqueue changes to WriteBuffer (background sync)
 * - Track sync status (_status, _timestamp)
 */

import { db } from "../db";
import { PresetSchema, type Preset } from "@deeprecall/core";
import { createWriteBuffer } from "../writeBuffer";
import { v4 as uuidv4 } from "uuid";

/**
 * Local change record with sync metadata
 */
export interface LocalPresetChange {
  _localId?: number; // Dexie auto-increment
  id: string; // Preset ID
  _op: "insert" | "update" | "delete";
  _status: "pending" | "syncing" | "synced" | "error";
  _timestamp: number; // Local timestamp
  _error?: string; // Error message if sync failed

  // Preset data (for insert/update)
  data?: Preset;
}

const buffer = createWriteBuffer();

/**
 * Create a new preset locally (optimistic)
 * Writes to local Dexie immediately, enqueues for sync
 */
export async function createPresetLocal(
  data: Omit<Preset, "id" | "kind" | "createdAt" | "updatedAt">
): Promise<Preset> {
  const preset: Preset = PresetSchema.parse({
    ...data,
    id: uuidv4(),
    kind: "preset",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 1. Write to local Dexie (instant)
  await db.presets_local.add({
    id: preset.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: preset,
  });

  // 2. Enqueue for background sync
  await buffer.enqueue({
    table: "presets",
    op: "insert",
    payload: preset,
  });

  console.log(`[Local] Created preset ${preset.id} (pending sync)`);
  return preset;
}

/**
 * Update a preset locally (optimistic)
 */
export async function updatePresetLocal(
  id: string,
  updates: Partial<Preset>
): Promise<void> {
  const updatedData = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // 1. Update/add to local Dexie
  await db.presets_local.put({
    id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: updatedData as any, // Partial data for update
  });

  // 2. Enqueue for background sync
  await buffer.enqueue({
    table: "presets",
    op: "update",
    payload: { id, ...updatedData },
  });

  console.log(`[Local] Updated preset ${id} (pending sync)`);
}

/**
 * Delete a preset locally (optimistic)
 */
export async function deletePresetLocal(id: string): Promise<void> {
  // 1. Mark as deleted in local Dexie
  await db.presets_local.put({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
  });

  // 2. Enqueue for background sync
  await buffer.enqueue({
    table: "presets",
    op: "delete",
    payload: { id },
  });

  console.log(`[Local] Deleted preset ${id} (pending sync)`);
}

/**
 * Get all local pending changes
 */
export async function getLocalPresetChanges(): Promise<LocalPresetChange[]> {
  return db.presets_local.toArray();
}

/**
 * Mark a local change as synced and remove it
 */
export async function markPresetSynced(id: string): Promise<void> {
  await db.presets_local.where("id").equals(id).delete();
  console.log(`[Local] Cleaned up synced preset ${id}`);
}

/**
 * Mark a local change as failed
 */
export async function markPresetSyncFailed(
  id: string,
  error: string
): Promise<void> {
  await db.presets_local.where("id").equals(id).modify({
    _status: "error",
    _error: error,
  });
  console.warn(`[Local] Preset ${id} sync failed: ${error}`);
}

/**
 * Clear all synced local changes
 */
export async function clearSyncedPresets(): Promise<number> {
  const synced = await db.presets_local
    .where("_status")
    .equals("synced")
    .toArray();
  await db.presets_local.where("_status").equals("synced").delete();
  console.log(`[Local] Cleaned up ${synced.length} synced presets`);
  return synced.length;
}
