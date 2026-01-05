/**
 * Attempts Cleanup Repository
 *
 * Auto-cleanup confirmed syncs and manage error states.
 */

import type { ExerciseAttempt } from "@deeprecall/dojo-core";
import { dojoDb } from "../db";
import { logger } from "@deeprecall/telemetry";

let attemptCleanupTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Clean up local attempt changes that have been confirmed synced
 */
export async function cleanupSyncedExerciseAttempts(
  syncedAttempts: ExerciseAttempt[]
): Promise<void> {
  if (attemptCleanupTimeout) {
    clearTimeout(attemptCleanupTimeout);
  }

  attemptCleanupTimeout = setTimeout(async () => {
    const syncedIds = new Set(syncedAttempts.map((a) => a.id as string));
    const localChanges = await dojoDb.dojo_exercise_attempts_local.toArray();

    let deletedCount = 0;

    for (const localChange of localChanges) {
      if (syncedIds.has(localChange.id)) {
        if (localChange._op === "insert" || localChange._op === "update") {
          await dojoDb.dojo_exercise_attempts_local.delete(
            localChange._localId!
          );
          deletedCount++;
        }
      } else {
        if (localChange._op === "delete") {
          await dojoDb.dojo_exercise_attempts_local.delete(
            localChange._localId!
          );
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      logger.info("db.local", "Cleanup: Removed confirmed attempt changes", {
        count: deletedCount,
      });
    }

    // Also clean up subtask attempts
    const subtaskLocalChanges =
      await dojoDb.dojo_subtask_attempts_local.toArray();
    let subtaskDeletedCount = 0;

    for (const localChange of subtaskLocalChanges) {
      // Subtask attempts are tied to exercise attempts
      // If the parent attempt is synced, the subtasks should be too
      if (localChange._op === "insert" || localChange._op === "update") {
        // Check if parent attempt is synced
        const parentAttemptId = (localChange.data as any)?.attempt_id;
        if (parentAttemptId && syncedIds.has(parentAttemptId)) {
          await dojoDb.dojo_subtask_attempts_local.delete(
            localChange._localId!
          );
          subtaskDeletedCount++;
        }
      }
    }

    if (subtaskDeletedCount > 0) {
      logger.info(
        "db.local",
        "Cleanup: Removed confirmed subtask attempt changes",
        {
          count: subtaskDeletedCount,
        }
      );
    }
  }, 100);
}

/**
 * Clean up old error states (>7 days)
 */
export async function cleanupOldAttemptErrors(): Promise<void> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // Cleanup attempts
  const attemptErrors = await dojoDb.dojo_exercise_attempts_local
    .where("_status")
    .equals("error")
    .and((change) => change._timestamp < sevenDaysAgo)
    .toArray();

  if (attemptErrors.length > 0) {
    await dojoDb.dojo_exercise_attempts_local.bulkDelete(
      attemptErrors.map((c) => c._localId!)
    );
    logger.info("db.local", "Cleanup: Removed old attempt errors", {
      count: attemptErrors.length,
    });
  }

  // Cleanup subtask attempts
  const subtaskErrors = await dojoDb.dojo_subtask_attempts_local
    .where("_status")
    .equals("error")
    .and((change) => change._timestamp < sevenDaysAgo)
    .toArray();

  if (subtaskErrors.length > 0) {
    await dojoDb.dojo_subtask_attempts_local.bulkDelete(
      subtaskErrors.map((c) => c._localId!)
    );
    logger.info("db.local", "Cleanup: Removed old subtask attempt errors", {
      count: subtaskErrors.length,
    });
  }
}
