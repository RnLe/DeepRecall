/**
 * Scheduler Merged Repository (Read Layer)
 *
 * Combines synced data (from Electric) + local changes (from Dexie)
 * Returns instant feedback with _local metadata for sync status.
 */

import type { SchedulerItem } from "@deeprecall/dojo-core";
import { dojoDb, type LocalChange } from "../db";
import { schedulerItemToDomain } from "../mappers";
import type { DojoSchedulerItemRow } from "../types/rows";
import { logger } from "@deeprecall/telemetry";

export interface MergedSchedulerItem extends SchedulerItem {
  _local?: {
    op: "insert" | "update" | "delete";
    status: "pending" | "syncing" | "synced" | "error";
    timestamp: number;
  };
}

/**
 * Merge synced scheduler items with local changes
 */
export async function mergeSchedulerItems(
  synced: DojoSchedulerItemRow[],
  local: LocalChange<DojoSchedulerItemRow>[]
): Promise<MergedSchedulerItem[]> {
  const syncedMap = new Map(synced.map((row) => [row.id, row]));
  const result: MergedSchedulerItem[] = [];

  const pendingInserts = new Map<string, LocalChange<DojoSchedulerItemRow>>();
  const pendingUpdates = new Map<string, LocalChange<DojoSchedulerItemRow>[]>();
  const pendingDeletes = new Set<string>();

  for (const localChange of local) {
    if (localChange._op === "insert") {
      pendingInserts.set(localChange.id, localChange);
    } else if (localChange._op === "update") {
      if (!pendingUpdates.has(localChange.id)) {
        pendingUpdates.set(localChange.id, []);
      }
      pendingUpdates.get(localChange.id)!.push(localChange);
    } else if (localChange._op === "delete") {
      pendingDeletes.add(localChange.id);
    }
  }

  const processedIds = new Set<string>();

  // First: Add items with pending inserts
  for (const [id, insertChange] of pendingInserts) {
    if (pendingDeletes.has(id)) {
      processedIds.add(id);
      continue;
    }

    if (!insertChange.data) continue;

    let row = insertChange.data;
    let latestTimestamp = insertChange._timestamp;
    let latestStatus = insertChange._status;

    const updates = pendingUpdates.get(id);
    if (updates) {
      for (const update of updates) {
        if (update.data) {
          row = { ...row, ...update.data };
        }
        latestTimestamp = Math.max(latestTimestamp, update._timestamp);
        latestStatus = update._status;
      }
    }

    result.push({
      ...schedulerItemToDomain(row),
      _local: {
        op: "insert",
        status: latestStatus,
        timestamp: latestTimestamp,
      },
    });
    processedIds.add(id);
    syncedMap.delete(id);
  }

  // Second: Add synced items with updates
  for (const [id, updates] of pendingUpdates) {
    if (processedIds.has(id) || pendingDeletes.has(id)) {
      continue;
    }

    const syncedRow = syncedMap.get(id);
    if (syncedRow) {
      let merged = { ...syncedRow };
      let latestTimestamp = 0;
      let latestStatus: "pending" | "syncing" | "synced" | "error" = "pending";

      for (const update of updates) {
        if (update.data) {
          merged = { ...merged, ...update.data };
        }
        latestTimestamp = Math.max(latestTimestamp, update._timestamp);
        latestStatus = update._status;
      }

      result.push({
        ...schedulerItemToDomain(merged),
        _local: {
          op: "update",
          status: latestStatus,
          timestamp: latestTimestamp,
        },
      });
      processedIds.add(id);
      syncedMap.delete(id);
    }
  }

  // Third: Add remaining synced items
  for (const [id, row] of syncedMap) {
    if (pendingDeletes.has(id)) {
      continue;
    }
    result.push(schedulerItemToDomain(row));
  }

  return result;
}

/**
 * Get merged scheduler items from Dexie
 */
export async function getMergedSchedulerItems(
  userId?: string
): Promise<MergedSchedulerItem[]> {
  let synced = await dojoDb.dojo_scheduler_items.toArray();
  if (userId) {
    synced = synced.filter((row) => row.owner_id === userId);
  }

  const local = await dojoDb.dojo_scheduler_items_local.toArray();

  return mergeSchedulerItems(synced, local);
}

/**
 * Get merged pending (uncompleted) scheduler items
 */
export async function getMergedPendingSchedulerItems(
  userId?: string
): Promise<MergedSchedulerItem[]> {
  const allItems = await getMergedSchedulerItems(userId);
  return allItems.filter((item) => !item.completed);
}

/**
 * Get merged due scheduler items (scheduled_for <= now)
 */
export async function getMergedDueSchedulerItems(
  userId?: string
): Promise<MergedSchedulerItem[]> {
  const now = new Date().toISOString();
  const allItems = await getMergedSchedulerItems(userId);
  return allItems.filter((item) => !item.completed && item.scheduledFor <= now);
}

/**
 * Get merged scheduler items for a specific template
 */
export async function getMergedSchedulerItemsByTemplate(
  templateId: string,
  userId?: string
): Promise<MergedSchedulerItem[]> {
  const allItems = await getMergedSchedulerItems(userId);
  return allItems.filter((item) => item.templateId === templateId);
}

/**
 * Get a single merged scheduler item by ID
 */
export async function getMergedSchedulerItem(
  id: string
): Promise<MergedSchedulerItem | undefined> {
  const localChanges = await dojoDb.dojo_scheduler_items_local
    .where("id")
    .equals(id)
    .toArray();

  if (localChanges.some((c) => c._op === "delete")) {
    return undefined;
  }

  const synced = await dojoDb.dojo_scheduler_items.get(id);

  if (localChanges.length > 0) {
    const insertChange = localChanges.find((c) => c._op === "insert");
    const updates = localChanges.filter((c) => c._op === "update");

    let row: DojoSchedulerItemRow;
    let latestTimestamp = 0;
    let latestStatus: "pending" | "syncing" | "synced" | "error" = "pending";
    let op: "insert" | "update" = "update";

    if (insertChange?.data) {
      row = insertChange.data;
      latestTimestamp = insertChange._timestamp;
      latestStatus = insertChange._status;
      op = "insert";
    } else if (synced) {
      row = synced;
    } else {
      return undefined;
    }

    for (const update of updates) {
      if (update.data) {
        row = { ...row, ...update.data };
      }
      latestTimestamp = Math.max(latestTimestamp, update._timestamp);
      latestStatus = update._status;
    }

    return {
      ...schedulerItemToDomain(row),
      _local: {
        op,
        status: latestStatus,
        timestamp: latestTimestamp,
      },
    };
  }

  if (synced) {
    return schedulerItemToDomain(synced);
  }

  return undefined;
}

/**
 * Get merged items scheduled for today
 */
export async function getMergedTodaySchedulerItems(
  userId?: string
): Promise<MergedSchedulerItem[]> {
  const today = new Date();
  const startOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).toISOString();
  const endOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1
  ).toISOString();

  const allItems = await getMergedSchedulerItems(userId);
  return allItems.filter(
    (item) =>
      !item.completed &&
      item.scheduledFor >= startOfDay &&
      item.scheduledFor < endOfDay
  );
}
