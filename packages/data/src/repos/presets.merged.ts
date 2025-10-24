/**
 * Presets Merged Repository (Merge Layer)
 *
 * Combines synced data from Electric with pending local changes
 * for a consistent view across the UI.
 *
 * Responsibilities:
 * - Merge presets (synced) + presets_local (pending)
 * - Apply conflict resolution rules
 * - Provide single source of truth for UI
 *
 * Merge Rules:
 * 1. Local INSERT: Show local preset immediately (pending sync)
 * 2. Local UPDATE: Override synced data with local changes
 * 3. Local DELETE: Filter out from synced data
 * 4. Sync conflicts: Local wins (user's latest intent)
 */

import { db } from "../db";
import type { Preset } from "@deeprecall/core";
import type { LocalPresetChange } from "./presets.local";

/**
 * Merged preset with sync status metadata
 */
export interface MergedPreset extends Preset {
  _local?: {
    status: "pending" | "syncing" | "synced" | "error";
    timestamp: number;
    error?: string;
  };
}

/**
 * Merge synced presets with local pending changes
 *
 * CRITICAL: Collects ALL updates per ID and applies them sequentially
 * to ensure user's full intent is reflected (create → update title → update color)
 *
 * @param synced - Presets from Electric (source of truth after sync)
 * @param local - Pending local changes from Dexie
 * @returns Merged array with local changes applied
 */
export function mergePresets(
  synced: Preset[],
  local: LocalPresetChange[]
): MergedPreset[] {
  // Phase 1: Collect by type (CRITICAL: Array for updates to capture ALL changes)
  const pendingInserts = new Map<string, LocalPresetChange>();
  const pendingUpdates = new Map<string, LocalPresetChange[]>(); // Array per ID!
  const pendingDeletes = new Set<string>();

  for (const change of local) {
    if (change._op === "insert") {
      pendingInserts.set(change.id, change);
    } else if (change._op === "update") {
      if (!pendingUpdates.has(change.id)) {
        pendingUpdates.set(change.id, []);
      }
      pendingUpdates.get(change.id)!.push(change); // Collect ALL updates
    } else if (change._op === "delete") {
      pendingDeletes.add(change.id);
    }
  }

  const merged: MergedPreset[] = [];
  const processedIds = new Set<string>();

  // Phase 2: Process pending inserts (may have updates too)
  for (const [id, insert] of pendingInserts) {
    if (pendingDeletes.has(id)) continue; // Deleted before sync

    let mergedData: any = insert.data;
    const updates = pendingUpdates.get(id);
    if (updates) {
      // Apply all updates sequentially
      for (const update of updates) {
        mergedData = { ...mergedData, ...update.data };
      }
    }

    merged.push({
      ...mergedData,
      _local: {
        status: insert._status,
        timestamp: insert._timestamp,
        error: insert._error,
      },
    });
    processedIds.add(id);
  }

  // Phase 3: Process synced items with updates
  for (const syncedPreset of synced) {
    if (processedIds.has(syncedPreset.id)) continue; // Already processed
    if (pendingDeletes.has(syncedPreset.id)) continue; // Deleted locally

    const updates = pendingUpdates.get(syncedPreset.id);
    if (updates) {
      // Apply all updates sequentially
      let mergedData: any = syncedPreset;
      for (const update of updates) {
        mergedData = { ...mergedData, ...update.data };
      }
      merged.push({
        ...mergedData,
        _local: {
          status: updates[updates.length - 1]._status,
          timestamp: updates[updates.length - 1]._timestamp,
          error: updates[updates.length - 1]._error,
        },
      });
    } else {
      // No local changes - use synced data as-is
      merged.push(syncedPreset);
    }
    processedIds.add(syncedPreset.id);
  }

  return merged;
}

/**
 * Get merged preset by ID
 */
export async function getMergedPreset(
  id: string
): Promise<MergedPreset | undefined> {
  try {
    // Get synced preset
    const synced = await db.presets.get(id);

    // Get local changes for this preset
    const localChanges = await db.presets_local
      .where("id")
      .equals(id)
      .toArray();

    if (!synced && localChanges.length === 0) {
      return undefined;
    }

    // Merge single preset
    const merged = mergePresets(synced ? [synced] : [], localChanges);

    return merged[0];
  } catch (error) {
    console.error("[getMergedPreset] Error:", error);
    return undefined;
  }
}

/**
 * Get all merged presets
 */
export async function getAllMergedPresets(): Promise<MergedPreset[]> {
  try {
    const [synced, local] = await Promise.all([
      db.presets.toArray(),
      db.presets_local.toArray(),
    ]);

    return mergePresets(synced, local);
  } catch (error) {
    console.error("[getAllMergedPresets] Error:", error);
    return []; // Always return array, never undefined
  }
}

/**
 * Get merged presets filtered by target entity
 */
export async function getMergedPresetsForTarget(
  targetEntity: string
): Promise<MergedPreset[]> {
  try {
    const [synced, local] = await Promise.all([
      db.presets.where("targetEntity").equals(targetEntity).toArray(),
      db.presets_local.toArray(), // Get all local changes (filter during merge)
    ]);

    // Merge all, then filter (in case local change modifies targetEntity)
    const merged = mergePresets(synced, local);
    return merged.filter((p) => p.targetEntity === targetEntity);
  } catch (error) {
    console.error("[getMergedPresetsForTarget] Error:", error);
    return []; // Always return array, never undefined
  }
}

/**
 * Get merged system presets
 */
export async function getMergedSystemPresets(): Promise<MergedPreset[]> {
  try {
    const [synced, local] = await Promise.all([
      db.presets.where("isSystem").equals(1).toArray(), // Dexie uses 1/0 for booleans
      db.presets_local.toArray(),
    ]);

    const merged = mergePresets(synced, local);
    return merged.filter((p) => p.isSystem === true);
  } catch (error) {
    console.error("[getMergedSystemPresets] Error:", error);
    return []; // Always return array, never undefined
  }
}
