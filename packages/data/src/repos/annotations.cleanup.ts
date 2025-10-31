/**
 * Cleanup repository for Annotation entities
 * Auto-cleanup confirmed syncs and manage error states
 */

import type { Annotation } from "@deeprecall/core";
import { db } from "../db";
import { logger } from "@deeprecall/telemetry";

let cleanupTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Clean up local annotation changes that have been confirmed synced
 * Debounced to prevent redundant runs from multiple hooks
 */
export async function cleanupSyncedAnnotations(
  syncedAnnotations: Annotation[]
): Promise<void> {
  // Debounce cleanup (100ms)
  if (cleanupTimeout) {
    clearTimeout(cleanupTimeout);
  }

  cleanupTimeout = setTimeout(async () => {
    const syncedIds = new Set(syncedAnnotations.map((a) => a.id));
    const localChanges = await db.annotations_local.toArray();

    let deletedCount = 0;

    for (const localChange of localChanges) {
      // If synced, cleanup based on operation
      if (syncedIds.has(localChange.id)) {
        if (localChange._op === "insert" || localChange._op === "update") {
          // Confirmed synced
          await db.annotations_local.delete(localChange._localId!);
          deletedCount++;
        }
      } else {
        // Not in synced data
        if (localChange._op === "delete") {
          // Delete confirmed (not in synced data anymore)
          await db.annotations_local.delete(localChange._localId!);
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      logger.info("db.local", "Cleanup: Removed confirmed changes", {
        count: deletedCount,
      });
    }
  }, 100);
}

/**
 * Clean up old error states (>7 days)
 */
export async function cleanupOldErrors(): Promise<void> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const errorChanges = await db.annotations_local
    .where("_status")
    .equals("error")
    .and((change) => change._timestamp < sevenDaysAgo)
    .toArray();

  if (errorChanges.length > 0) {
    await db.annotations_local.bulkDelete(errorChanges.map((c) => c._localId!));
    logger.info("db.local", "Cleanup: Removed old errors", {
      count: errorChanges.length,
    });
  }
}
