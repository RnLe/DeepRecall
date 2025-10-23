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
 * @param synced - Presets from Electric (source of truth after sync)
 * @param local - Pending local changes from Dexie
 * @returns Merged array with local changes applied
 */
export function mergePresets(
  synced: Preset[],
  local: LocalPresetChange[]
): MergedPreset[] {
  // Index local changes by preset ID for O(1) lookup
  const localByPresetId = new Map<string, LocalPresetChange>();
  for (const change of local) {
    // Keep latest change per preset (highest timestamp)
    const existing = localByPresetId.get(change.id);
    if (!existing || change._timestamp > existing._timestamp) {
      localByPresetId.set(change.id, change);
    }
  }

  const merged: MergedPreset[] = [];
  const processedIds = new Set<string>();

  // 1. Apply local changes to synced presets
  for (const syncedPreset of synced) {
    const localChange = localByPresetId.get(syncedPreset.id);
    processedIds.add(syncedPreset.id);

    if (!localChange) {
      // No local changes - use synced data as-is
      merged.push(syncedPreset);
      continue;
    }

    // Apply local change based on operation
    switch (localChange._op) {
      case "delete":
        // Local delete - filter out from merged results (silent)
        break;

      case "update":
        // Local update - merge local changes into synced data
        const updatedPreset: MergedPreset = {
          ...syncedPreset,
          ...localChange.data, // Local changes override
          _local: {
            status: localChange._status,
            timestamp: localChange._timestamp,
            error: localChange._error,
          },
        };
        merged.push(updatedPreset);
        break;

      case "insert":
        // Conflict: both local insert and synced data exist
        // This means sync completed - prefer synced data but mark as synced
        merged.push({
          ...syncedPreset,
          _local: {
            status: "synced" as const,
            timestamp: localChange._timestamp,
          },
        });
        break;
    }
  }

  // 2. Add local inserts that haven't synced yet
  for (const [presetId, localChange] of localByPresetId) {
    if (processedIds.has(presetId)) continue; // Already processed above

    if (localChange._op === "insert" && localChange.data) {
      // Local insert pending sync - show in UI immediately
      const pendingPreset: MergedPreset = {
        ...localChange.data,
        _local: {
          status: localChange._status,
          timestamp: localChange._timestamp,
          error: localChange._error,
        },
      };
      merged.push(pendingPreset);
    }
  }

  return merged;
}

/**
 * Get merged preset by ID
 */
export async function getMergedPreset(
  id: string
): Promise<MergedPreset | undefined> {
  // Get synced preset
  const synced = await db.presets.get(id);

  // Get local changes for this preset
  const localChanges = await db.presets_local.where("id").equals(id).toArray();

  if (!synced && localChanges.length === 0) {
    return undefined;
  }

  // Merge single preset
  const merged = mergePresets(synced ? [synced] : [], localChanges);

  return merged[0];
}

/**
 * Get all merged presets
 */
export async function getAllMergedPresets(): Promise<MergedPreset[]> {
  const [synced, local] = await Promise.all([
    db.presets.toArray(),
    db.presets_local.toArray(),
  ]);

  return mergePresets(synced, local);
}

/**
 * Get merged presets filtered by target entity
 */
export async function getMergedPresetsForTarget(
  targetEntity: string
): Promise<MergedPreset[]> {
  const [synced, local] = await Promise.all([
    db.presets.where("targetEntity").equals(targetEntity).toArray(),
    db.presets_local.toArray(), // Get all local changes (filter during merge)
  ]);

  // Merge all, then filter (in case local change modifies targetEntity)
  const merged = mergePresets(synced, local);
  return merged.filter((p) => p.targetEntity === targetEntity);
}

/**
 * Get merged system presets
 */
export async function getMergedSystemPresets(): Promise<MergedPreset[]> {
  const [synced, local] = await Promise.all([
    db.presets.where("isSystem").equals(1).toArray(), // Dexie uses 1/0 for booleans
    db.presets_local.toArray(),
  ]);

  const merged = mergePresets(synced, local);
  return merged.filter((p) => p.isSystem === true);
}
