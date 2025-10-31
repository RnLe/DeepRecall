/**
 * Activities Merged Repository (Merge Layer)
 *
 * Combines synced data from Electric with pending local changes
 * for a consistent view across the UI.
 *
 * Responsibilities:
 * - Merge activities (synced) + activities_local (pending)
 * - Apply conflict resolution rules
 * - Provide single source of truth for UI
 *
 * Merge Rules:
 * 1. Local INSERT: Show local activity immediately (pending sync)
 * 2. Local UPDATE: Override synced data with local changes
 * 3. Local DELETE: Filter out from synced data
 * 4. Sync conflicts: Local wins (user's latest intent)
 */

import { db } from "../db";
import type { Activity } from "@deeprecall/core";
import { logger } from "@deeprecall/telemetry";
import type { LocalActivityChange } from "./activities.local";

/**
 * Merged activity with sync status metadata
 */
export interface MergedActivity extends Activity {
  _local?: {
    status: "pending" | "syncing" | "synced" | "error";
    timestamp: number;
    error?: string;
  };
}

/**
 * Merge synced activities with local pending changes
 *
 * CRITICAL: Collects ALL updates per ID and applies sequentially (Pattern 2)
 * Fixes bug where only last update was applied before sync
 *
 * @param synced - Activities from Electric (source of truth after sync)
 * @param local - Pending local changes from Dexie
 * @returns Merged array with local changes applied
 */
export function mergeActivities(
  synced: Activity[],
  local: LocalActivityChange[]
): MergedActivity[] {
  // Phase 1: Collect changes by type and ID
  const pendingInserts = new Map<string, LocalActivityChange>();
  const pendingUpdates = new Map<string, LocalActivityChange[]>(); // Array to collect ALL updates
  const pendingDeletes = new Set<string>();

  for (const change of local) {
    if (change._op === "insert") {
      // Keep latest insert per ID (shouldn't have multiple, but just in case)
      const existing = pendingInserts.get(change.id);
      if (!existing || change._timestamp > existing._timestamp) {
        pendingInserts.set(change.id, change);
      }
    } else if (change._op === "update") {
      // Collect ALL updates per ID (not just latest)
      if (!pendingUpdates.has(change.id)) {
        pendingUpdates.set(change.id, []);
      }
      pendingUpdates.get(change.id)!.push(change);
    } else if (change._op === "delete") {
      pendingDeletes.add(change.id);
    }
  }

  // Sort updates by timestamp for each ID
  for (const updates of pendingUpdates.values()) {
    updates.sort((a, b) => a._timestamp - b._timestamp);
  }

  const merged: MergedActivity[] = [];
  const processedIds = new Set<string>();
  const syncedMap = new Map(synced.map((a) => [a.id, a]));

  // Phase 2: Process pending inserts (may have updates on top)
  for (const [id, insert] of pendingInserts) {
    if (pendingDeletes.has(id)) continue; // Deleted before sync

    processedIds.add(id);
    let mergedActivity: MergedActivity = {
      ...(insert.data as Activity), // Assert data exists for insert
      _local: {
        status: insert._status,
        timestamp: insert._timestamp,
        error: insert._error,
      },
    };

    // Apply any updates that came after insert
    const updates = pendingUpdates.get(id);
    if (updates) {
      for (const update of updates) {
        mergedActivity = {
          ...mergedActivity,
          ...update.data,
          _local: {
            status: update._status,
            timestamp: update._timestamp,
            error: update._error,
          },
        };
      }
    }

    merged.push(mergedActivity);
  }

  // Phase 3: Process synced items with updates
  for (const [id, updates] of pendingUpdates) {
    if (processedIds.has(id)) continue; // Already processed as insert
    if (pendingDeletes.has(id)) continue; // Deleted

    const syncedItem = syncedMap.get(id);
    if (syncedItem) {
      processedIds.add(id);
      let mergedActivity: MergedActivity = { ...syncedItem };

      // Apply ALL updates sequentially
      for (const update of updates) {
        mergedActivity = {
          ...mergedActivity,
          ...update.data,
          _local: {
            status: update._status,
            timestamp: update._timestamp,
            error: update._error,
          },
        };
      }

      merged.push(mergedActivity);
    }
  }

  // Phase 4: Add synced items without local changes
  for (const syncedItem of synced) {
    if (processedIds.has(syncedItem.id)) continue; // Already processed
    if (pendingDeletes.has(syncedItem.id)) continue; // Deleted locally

    merged.push(syncedItem);
  }

  return merged;
}

/**
 * Get merged activity by ID
 */
export async function getMergedActivity(
  id: string
): Promise<MergedActivity | undefined> {
  try {
    // Get synced activity
    const synced = await db.activities.get(id);

    // Get local changes for this activity
    const localChanges = await db.activities_local
      .where("id")
      .equals(id)
      .toArray();

    if (!synced && localChanges.length === 0) {
      return undefined;
    }

    // Merge single activity
    const merged = mergeActivities(synced ? [synced] : [], localChanges);

    return merged[0];
  } catch (error) {
    logger.error("db.local", "Failed to get merged activity", {
      activityId: id,
      error: String(error),
    });
    return undefined;
  }
}

/**
 * Get all merged activities
 */
export async function getAllMergedActivities(): Promise<MergedActivity[]> {
  try {
    const [synced, local] = await Promise.all([
      db.activities.toArray(),
      db.activities_local.toArray(),
    ]);

    return mergeActivities(synced, local);
  } catch (error) {
    logger.error("db.local", "Failed to get all merged activities", {
      error: String(error),
    });
    return []; // Always return array, never undefined
  }
}

/**
 * Get merged activities filtered by type
 */
export async function getMergedActivitiesByType(
  activityType: string
): Promise<MergedActivity[]> {
  try {
    const [synced, local] = await Promise.all([
      db.activities.where("activityType").equals(activityType).toArray(),
      db.activities_local.toArray(), // Get all local changes (filter during merge)
    ]);

    // Merge all, then filter (in case local change modifies activityType)
    const merged = mergeActivities(synced, local);
    return merged.filter((a) => a.activityType === activityType);
  } catch (error) {
    logger.error("db.local", "Failed to get merged activities by type", {
      activityType,
      error: String(error),
    });
    return []; // Always return array, never undefined
  }
}

/**
 * Search merged activities by title (client-side)
 */
export async function searchMergedActivitiesByTitle(
  query: string
): Promise<MergedActivity[]> {
  try {
    const allActivities = await getAllMergedActivities();
    const lowerQuery = query.toLowerCase();

    return allActivities.filter((a) =>
      a.title.toLowerCase().includes(lowerQuery)
    );
  } catch (error) {
    logger.error("db.local", "Failed to search merged activities by title", {
      query,
      error: String(error),
    });
    return []; // Always return array, never undefined
  }
}

/**
 * Get merged activities in date range (client-side)
 */
export async function getMergedActivitiesInRange(
  startDate: string,
  endDate: string
): Promise<MergedActivity[]> {
  try {
    const allActivities = await getAllMergedActivities();

    return allActivities.filter((a) => {
      // Include if activity overlaps with date range
      if (!a.startsAt && !a.endsAt) return false;

      const activityStart = a.startsAt || startDate;
      const activityEnd = a.endsAt || endDate;

      return activityStart <= endDate && activityEnd >= startDate;
    });
  } catch (error) {
    logger.error("db.local", "Failed to get merged activities in range", {
      startDate,
      endDate,
      error: String(error),
    });
    return []; // Always return array, never undefined
  }
}
