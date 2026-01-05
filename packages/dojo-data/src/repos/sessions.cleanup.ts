/**
 * Sessions Cleanup Repository
 *
 * Auto-cleanup confirmed syncs and manage error states.
 */

import type { Session } from "@deeprecall/dojo-core";
import { dojoDb } from "../db";
import { logger } from "@deeprecall/telemetry";

let sessionCleanupTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Clean up local session changes that have been confirmed synced
 */
export async function cleanupSyncedSessions(
  syncedSessions: Session[]
): Promise<void> {
  if (sessionCleanupTimeout) {
    clearTimeout(sessionCleanupTimeout);
  }

  sessionCleanupTimeout = setTimeout(async () => {
    const syncedIds = new Set(syncedSessions.map((s) => s.id as string));
    const localChanges = await dojoDb.dojo_sessions_local.toArray();

    let deletedCount = 0;

    for (const localChange of localChanges) {
      if (syncedIds.has(localChange.id)) {
        if (localChange._op === "insert" || localChange._op === "update") {
          await dojoDb.dojo_sessions_local.delete(localChange._localId!);
          deletedCount++;
        }
      } else {
        if (localChange._op === "delete") {
          await dojoDb.dojo_sessions_local.delete(localChange._localId!);
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      logger.info("db.local", "Cleanup: Removed confirmed session changes", {
        count: deletedCount,
      });
    }
  }, 100);
}

/**
 * Clean up old error states (>7 days)
 */
export async function cleanupOldSessionErrors(): Promise<void> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const sessionErrors = await dojoDb.dojo_sessions_local
    .where("_status")
    .equals("error")
    .and((change) => change._timestamp < sevenDaysAgo)
    .toArray();

  if (sessionErrors.length > 0) {
    await dojoDb.dojo_sessions_local.bulkDelete(
      sessionErrors.map((c) => c._localId!)
    );
    logger.info("db.local", "Cleanup: Removed old session errors", {
      count: sessionErrors.length,
    });
  }
}
