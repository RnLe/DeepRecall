/**
 * Works Cleanup Utility
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
import type { Work } from "@deeprecall/core";

// Debounce cleanup to prevent redundant runs
let cleanupTimer: NodeJS.Timeout | null = null;
let lastCleanupHash = "";

/**
 * Clean up synced works from local table
 * Compares synced data with local changes and removes confirmed ones
 * Debounced to prevent redundant runs from multiple hooks
 *
 * @param syncedWorks - Current synced works from Electric
 */
export async function cleanupSyncedWorks(syncedWorks: Work[]): Promise<void> {
  // Debounce: wait 100ms for multiple calls to settle
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
  }

  return new Promise((resolve) => {
    cleanupTimer = setTimeout(async () => {
      await _cleanupSyncedWorksInternal(syncedWorks);
      resolve();
    }, 100);
  });
}

/**
 * Internal cleanup implementation (debounced)
 */
async function _cleanupSyncedWorksInternal(syncedWorks: Work[]): Promise<void> {
  const localChanges = await db.works_local.toArray();

  if (localChanges.length === 0) {
    return; // Nothing to clean up
  }

  // Skip if same data (prevents redundant cleanup from multiple hooks)
  const currentHash = `${syncedWorks.length}-${localChanges.length}`;
  if (currentHash === lastCleanupHash) {
    return;
  }
  lastCleanupHash = currentHash;

  const syncedIds = new Set(syncedWorks.map((w) => w.id));
  let cleanedCount = 0;

  for (const local of localChanges) {
    const isSynced = syncedIds.has(local.id);

    // Cleanup logic based on operation
    switch (local._op) {
      case "insert":
        // If synced data contains this ID, the insert was confirmed
        if (isSynced) {
          await db.works_local.where("id").equals(local.id).delete();
          cleanedCount++;
          console.log(`[Cleanup] Confirmed insert for work ${local.id}`);
        }
        break;

      case "update":
        // If synced data exists, check if our update was applied
        if (isSynced) {
          const synced = syncedWorks.find((w) => w.id === local.id);

          // Simple check: if timestamps match or synced is newer, assume synced
          if (synced && synced.updatedAt && local.data?.updatedAt) {
            const syncedTime = new Date(synced.updatedAt).getTime();
            const localTime = new Date(local.data.updatedAt).getTime();

            if (syncedTime >= localTime) {
              await db.works_local.where("id").equals(local.id).delete();
              cleanedCount++;
              console.log(`[Cleanup] Confirmed update for work ${local.id}`);
            }
          }
        }
        break;

      case "delete":
        // If synced data no longer contains this ID, the delete was confirmed
        if (!isSynced) {
          await db.works_local.where("id").equals(local.id).delete();
          cleanedCount++;
          console.log(`[Cleanup] Confirmed delete for work ${local.id}`);
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

  const oldErrors = await db.works_local
    .where("_status")
    .equals("error")
    .and((change) => change._timestamp < sevenDaysAgo)
    .toArray();

  if (oldErrors.length > 0) {
    await db.works_local
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
  const count = await db.works_local.where("_status").equals("synced").delete();
  console.log(`[Cleanup] Force removed ${count} synced records`);
  return;
}
