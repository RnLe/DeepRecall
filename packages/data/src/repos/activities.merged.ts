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
 * @param synced - Activities from Electric (source of truth after sync)
 * @param local - Pending local changes from Dexie
 * @returns Merged array with local changes applied
 */
export function mergeActivities(
  synced: Activity[],
  local: LocalActivityChange[]
): MergedActivity[] {
  // Index local changes by activity ID for O(1) lookup
  const localByActivityId = new Map<string, LocalActivityChange>();
  for (const change of local) {
    // Keep latest change per activity (highest timestamp)
    const existing = localByActivityId.get(change.id);
    if (!existing || change._timestamp > existing._timestamp) {
      localByActivityId.set(change.id, change);
    }
  }

  const merged: MergedActivity[] = [];
  const processedIds = new Set<string>();

  // 1. Apply local changes to synced activities
  for (const syncedActivity of synced) {
    const localChange = localByActivityId.get(syncedActivity.id);
    processedIds.add(syncedActivity.id);

    if (!localChange) {
      // No local changes - use synced data as-is
      merged.push(syncedActivity);
      continue;
    }

    // Apply local change based on operation
    switch (localChange._op) {
      case "delete":
        // Local delete - filter out from merged results (silent)
        break;

      case "update":
        // Local update - merge local changes into synced data
        const updatedActivity: MergedActivity = {
          ...syncedActivity,
          ...localChange.data, // Local changes override
          _local: {
            status: localChange._status,
            timestamp: localChange._timestamp,
            error: localChange._error,
          },
        };
        merged.push(updatedActivity);
        break;

      case "insert":
        // Conflict: both local insert and synced data exist
        // This means sync completed - prefer synced data but mark as synced
        merged.push({
          ...syncedActivity,
          _local: {
            status: "synced" as const,
            timestamp: localChange._timestamp,
          },
        });
        break;
    }
  }

  // 2. Add local inserts that haven't synced yet
  for (const [activityId, localChange] of localByActivityId) {
    if (processedIds.has(activityId)) continue; // Already processed above

    if (localChange._op === "insert" && localChange.data) {
      // Local insert pending sync - show in UI immediately
      const pendingActivity: MergedActivity = {
        ...localChange.data,
        _local: {
          status: localChange._status,
          timestamp: localChange._timestamp,
          error: localChange._error,
        },
      };
      merged.push(pendingActivity);
    }
  }

  return merged;
}

/**
 * Get merged activity by ID
 */
export async function getMergedActivity(
  id: string
): Promise<MergedActivity | undefined> {
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
}

/**
 * Get all merged activities
 */
export async function getAllMergedActivities(): Promise<MergedActivity[]> {
  const [synced, local] = await Promise.all([
    db.activities.toArray(),
    db.activities_local.toArray(),
  ]);

  return mergeActivities(synced, local);
}

/**
 * Get merged activities filtered by type
 */
export async function getMergedActivitiesByType(
  activityType: string
): Promise<MergedActivity[]> {
  const [synced, local] = await Promise.all([
    db.activities.where("activityType").equals(activityType).toArray(),
    db.activities_local.toArray(), // Get all local changes (filter during merge)
  ]);

  // Merge all, then filter (in case local change modifies activityType)
  const merged = mergeActivities(synced, local);
  return merged.filter((a) => a.activityType === activityType);
}

/**
 * Search merged activities by title (client-side)
 */
export async function searchMergedActivitiesByTitle(
  query: string
): Promise<MergedActivity[]> {
  const allActivities = await getAllMergedActivities();
  const lowerQuery = query.toLowerCase();

  return allActivities.filter((a) =>
    a.title.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get merged activities in date range (client-side)
 */
export async function getMergedActivitiesInRange(
  startDate: string,
  endDate: string
): Promise<MergedActivity[]> {
  const allActivities = await getAllMergedActivities();

  return allActivities.filter((a) => {
    // Include if activity overlaps with date range
    if (!a.startsAt && !a.endsAt) return false;

    const activityStart = a.startsAt || startDate;
    const activityEnd = a.endsAt || endDate;

    return activityStart <= endDate && activityEnd >= startDate;
  });
}
