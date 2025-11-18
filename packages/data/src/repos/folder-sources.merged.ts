/**
 * Folder Sources Merge Layer
 *
 * Combines synced folder sources with local pending changes so the UI can
 * render immediately even before backend support exists.
 */

import { db } from "../db";
import type { FolderSource } from "@deeprecall/core";
import type { LocalFolderSourceChange } from "./folder-sources.local";
import { logger } from "@deeprecall/telemetry";

export interface MergedFolderSource extends FolderSource {
  _local?: {
    status: "pending" | "syncing" | "synced" | "error";
    timestamp: number;
    error?: string;
  };
}

function normalizeDefaults(
  sources: MergedFolderSource[]
): MergedFolderSource[] {
  const byDevice = new Map<string, MergedFolderSource[]>();

  for (const source of sources) {
    const bucket = byDevice.get(source.deviceId) ?? [];
    bucket.push(source);
    byDevice.set(source.deviceId, bucket);
  }

  for (const bucket of byDevice.values()) {
    const defaults = bucket.filter((entry) => entry.isDefault);
    if (defaults.length <= 1) continue;

    defaults.sort((a, b) => {
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return bTime - aTime;
    });

    const keeper = defaults[0]?.id;
    bucket.forEach((entry) => {
      if (entry.isDefault && entry.id !== keeper) {
        entry.isDefault = false;
      }
    });
  }

  return sources;
}

export function mergeFolderSources(
  synced: FolderSource[],
  local: LocalFolderSourceChange[]
): MergedFolderSource[] {
  const pendingInserts = new Map<string, LocalFolderSourceChange>();
  const pendingUpdates = new Map<string, LocalFolderSourceChange[]>();
  const pendingDeletes = new Set<string>();

  for (const change of local) {
    if (change._op === "insert") {
      pendingInserts.set(change.id, change);
    } else if (change._op === "update") {
      const updates = pendingUpdates.get(change.id) ?? [];
      updates.push(change);
      pendingUpdates.set(change.id, updates);
    } else if (change._op === "delete") {
      pendingDeletes.add(change.id);
    }
  }

  const merged: MergedFolderSource[] = [];
  const processedIds = new Set<string>();

  for (const [id, insert] of pendingInserts) {
    if (pendingDeletes.has(id) || !insert.data) continue;
    let mergedData: FolderSource = insert.data as FolderSource;
    const updates = pendingUpdates.get(id);
    if (updates) {
      for (const update of updates) {
        if (!update.data) continue;
        mergedData = {
          ...mergedData,
          ...(update.data as FolderSource),
        };
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

  for (const syncedSource of synced) {
    if (processedIds.has(syncedSource.id)) continue;
    if (pendingDeletes.has(syncedSource.id)) continue;

    const updates = pendingUpdates.get(syncedSource.id);
    if (updates && updates.length > 0) {
      let mergedData: FolderSource = syncedSource;
      for (const update of updates) {
        if (!update.data) continue;
        mergedData = {
          ...mergedData,
          ...(update.data as FolderSource),
        };
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
      merged.push(syncedSource);
    }
    processedIds.add(syncedSource.id);
  }

  return normalizeDefaults(merged);
}

export async function getAllMergedFolderSources(): Promise<
  MergedFolderSource[]
> {
  try {
    const [synced, local] = await Promise.all([
      db.folderSources.toArray(),
      db.folderSources_local.toArray(),
    ]);
    return mergeFolderSources(synced, local);
  } catch (error) {
    logger.error("db.local", "Failed to read folder sources", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function getMergedFolderSource(
  id: string
): Promise<MergedFolderSource | undefined> {
  try {
    const [synced, local] = await Promise.all([
      db.folderSources.where("id").equals(id).first(),
      db.folderSources_local.where("id").equals(id).toArray(),
    ]);

    const merged = mergeFolderSources(synced ? [synced] : [], local);
    return merged[0];
  } catch (error) {
    logger.error("db.local", "Failed to read folder source", {
      folderSourceId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
