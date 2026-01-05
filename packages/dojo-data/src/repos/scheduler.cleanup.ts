/**
 * Scheduler Cleanup Repository
 *
 * Auto-cleanup confirmed syncs and manage error states.
 */

import type { SchedulerItem } from "@deeprecall/dojo-core";
import { dojoDb } from "../db";
import { logger } from "@deeprecall/telemetry";

let schedulerCleanupTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Clean up local scheduler item changes that have been confirmed synced
 */
export async function cleanupSyncedSchedulerItems(
  syncedItems: SchedulerItem[]
): Promise<void> {
  if (schedulerCleanupTimeout) {
    clearTimeout(schedulerCleanupTimeout);
  }

  schedulerCleanupTimeout = setTimeout(async () => {
    const syncedIds = new Set(syncedItems.map((i) => i.id as string));
    const localChanges = await dojoDb.dojo_scheduler_items_local.toArray();

    let deletedCount = 0;

    for (const localChange of localChanges) {
      if (syncedIds.has(localChange.id)) {
        if (localChange._op === "insert" || localChange._op === "update") {
          await dojoDb.dojo_scheduler_items_local.delete(localChange._localId!);
          deletedCount++;
        }
      } else {
        if (localChange._op === "delete") {
          await dojoDb.dojo_scheduler_items_local.delete(localChange._localId!);
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      logger.info(
        "db.local",
        "Cleanup: Removed confirmed scheduler item changes",
        {
          count: deletedCount,
        }
      );
    }
  }, 100);
}

/**
 * Clean up old error states (>7 days)
 */
export async function cleanupOldSchedulerErrors(): Promise<void> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const schedulerErrors = await dojoDb.dojo_scheduler_items_local
    .where("_status")
    .equals("error")
    .and((change) => change._timestamp < sevenDaysAgo)
    .toArray();

  if (schedulerErrors.length > 0) {
    await dojoDb.dojo_scheduler_items_local.bulkDelete(
      schedulerErrors.map((c) => c._localId!)
    );
    logger.info("db.local", "Cleanup: Removed old scheduler item errors", {
      count: schedulerErrors.length,
    });
  }
}

/**
 * Clean up old completed scheduler items (>30 days)
 * This helps keep the scheduler table lean over time
 */
export async function cleanupOldCompletedItems(): Promise<void> {
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const completedItems = await dojoDb.dojo_scheduler_items
    .where("completed")
    .equals(1) // Dexie boolean indexing
    .and(
      (item) => item.completed_at != null && item.completed_at < thirtyDaysAgo
    )
    .toArray();

  if (completedItems.length > 0) {
    await dojoDb.dojo_scheduler_items.bulkDelete(
      completedItems.map((item) => item.id)
    );
    logger.info("db.local", "Cleanup: Removed old completed scheduler items", {
      count: completedItems.length,
    });
  }
}
