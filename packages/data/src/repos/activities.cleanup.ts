/**
 * Activities Cleanup Utility
 *
 * Automatically removes local changes after Electric confirms sync
 *
 * Responsibilities:
 * - Watch Electric shapes for new data
 * - Match synced records to local changes
 * - Delete confirmed local records
 * - Handle sync failures and retries
 */

import { db } from "../db";
import type { Activity } from "@deeprecall/core";

// Debounce cleanup to prevent redundant runs
let cleanupTimer: NodeJS.Timeout | null = null;
let lastCleanupHash = "";

/**
 * Clean up synced activities from local table
 * Compares synced data with local changes and removes confirmed ones
 * Debounced to prevent redundant runs from multiple hooks
 *
 * @param syncedActivities - Current synced activities from Electric
 */
export async function cleanupSyncedActivities(
  syncedActivities: Activity[]
): Promise<void> {
  // Debounce: wait 100ms for multiple calls to settle
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
  }

  return new Promise((resolve) => {
    cleanupTimer = setTimeout(async () => {
      await _cleanupSyncedActivitiesInternal(syncedActivities);
      resolve();
    }, 100);
  });
}

/**
 * Internal cleanup implementation (debounced)
 */
async function _cleanupSyncedActivitiesInternal(
  syncedActivities: Activity[]
): Promise<void> {
  const localChanges = await db.activities_local.toArray();

  if (localChanges.length === 0) {
    return; // Nothing to clean up
  }

  // Skip if same data (prevents redundant cleanup from multiple hooks)
  const currentHash = `${syncedActivities.length}-${localChanges.length}`;
  if (currentHash === lastCleanupHash) {
    return;
  }
  lastCleanupHash = currentHash;

  const syncedIds = new Set(syncedActivities.map((a) => a.id));
  let cleanedCount = 0;

  for (const local of localChanges) {
    const isSynced = syncedIds.has(local.id);

    // Cleanup logic based on operation
    switch (local._op) {
      case "insert":
        // If synced data contains this ID, the insert was confirmed
        if (isSynced) {
          await db.activities_local.where("id").equals(local.id).delete();
          cleanedCount++;
          console.log(`[Cleanup] Confirmed insert for activity ${local.id}`);
        }
        break;

      case "update":
        // If synced data exists, check if our update was applied
        if (isSynced) {
          const synced = syncedActivities.find((a) => a.id === local.id);

          // Simple check: if timestamps match or synced is newer, assume synced
          if (synced && synced.updatedAt && local.data?.updatedAt) {
            const syncedTime = new Date(synced.updatedAt).getTime();
            const localTime = new Date(local.data.updatedAt).getTime();

            if (syncedTime >= localTime) {
              await db.activities_local.where("id").equals(local.id).delete();
              cleanedCount++;
              console.log(
                `[Cleanup] Confirmed update for activity ${local.id}`
              );
            }
          }
        }
        break;

      case "delete":
        // If synced data no longer contains this ID, the delete was confirmed
        if (!isSynced) {
          await db.activities_local.where("id").equals(local.id).delete();
          cleanedCount++;
          console.log(`[Cleanup] Confirmed delete for activity ${local.id}`);
        }
        break;
    }
  }

  if (cleanedCount > 0) {
    console.log(`✅ [Cleanup] Removed ${cleanedCount} confirmed local changes`);
  }
}

/**
 * Clean up old failed syncs (>7 days)
 * Prevents local table from growing indefinitely
 */
export async function cleanupOldErrors(): Promise<void> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const oldErrors = await db.activities_local
    .where("_status")
    .equals("error")
    .and((change) => change._timestamp < sevenDaysAgo)
    .toArray();

  if (oldErrors.length > 0) {
    await db.activities_local
      .where("_status")
      .equals("error")
      .and((change) => change._timestamp < sevenDaysAgo)
      .delete();

    console.log(
      `🗑️ [Cleanup] Removed ${oldErrors.length} old error records (>7 days)`
    );
  }
}

/**
 * Force cleanup all synced records (for testing/debugging)
 */
export async function forceCleanupAll(): Promise<void> {
  const count = await db.activities_local
    .where("_status")
    .equals("synced")
    .delete();
  console.log(`[Cleanup] Force removed ${count} synced records`);
  return;
}
