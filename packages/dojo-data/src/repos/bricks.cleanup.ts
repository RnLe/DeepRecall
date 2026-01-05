/**
 * Bricks Cleanup Repository
 *
 * Auto-cleanup confirmed syncs and manage error states.
 */

import type {
  ConceptBrickState,
  ExerciseBrickState,
} from "@deeprecall/dojo-core";
import { dojoDb } from "../db";
import { logger } from "@deeprecall/telemetry";

let conceptBrickCleanupTimeout: ReturnType<typeof setTimeout> | null = null;
let exerciseBrickCleanupTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Clean up local concept brick changes that have been confirmed synced
 */
export async function cleanupSyncedConceptBricks(
  syncedBricks: ConceptBrickState[]
): Promise<void> {
  if (conceptBrickCleanupTimeout) {
    clearTimeout(conceptBrickCleanupTimeout);
  }

  conceptBrickCleanupTimeout = setTimeout(async () => {
    const syncedIds = new Set(syncedBricks.map((b) => b.id as string));
    const localChanges = await dojoDb.dojo_concept_bricks_local.toArray();

    let deletedCount = 0;

    for (const localChange of localChanges) {
      if (syncedIds.has(localChange.id)) {
        if (localChange._op === "insert") {
          await dojoDb.dojo_concept_bricks_local.delete(localChange._localId!);
          deletedCount++;
        }
      } else {
        if (localChange._op === "delete") {
          await dojoDb.dojo_concept_bricks_local.delete(localChange._localId!);
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      logger.info(
        "db.local",
        "Cleanup: Removed confirmed concept brick changes",
        {
          count: deletedCount,
        }
      );
    }
  }, 100);
}

/**
 * Clean up local exercise brick changes that have been confirmed synced
 */
export async function cleanupSyncedExerciseBricks(
  syncedBricks: ExerciseBrickState[]
): Promise<void> {
  if (exerciseBrickCleanupTimeout) {
    clearTimeout(exerciseBrickCleanupTimeout);
  }

  exerciseBrickCleanupTimeout = setTimeout(async () => {
    const syncedIds = new Set(syncedBricks.map((b) => b.id as string));
    const localChanges = await dojoDb.dojo_exercise_bricks_local.toArray();

    let deletedCount = 0;

    for (const localChange of localChanges) {
      if (syncedIds.has(localChange.id)) {
        if (localChange._op === "insert") {
          await dojoDb.dojo_exercise_bricks_local.delete(localChange._localId!);
          deletedCount++;
        }
      } else {
        if (localChange._op === "delete") {
          await dojoDb.dojo_exercise_bricks_local.delete(localChange._localId!);
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      logger.info(
        "db.local",
        "Cleanup: Removed confirmed exercise brick changes",
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
export async function cleanupOldBrickErrors(): Promise<void> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // Cleanup concept bricks
  const conceptBrickErrors = await dojoDb.dojo_concept_bricks_local
    .where("_status")
    .equals("error")
    .and((change) => change._timestamp < sevenDaysAgo)
    .toArray();

  if (conceptBrickErrors.length > 0) {
    await dojoDb.dojo_concept_bricks_local.bulkDelete(
      conceptBrickErrors.map((c) => c._localId!)
    );
    logger.info("db.local", "Cleanup: Removed old concept brick errors", {
      count: conceptBrickErrors.length,
    });
  }

  // Cleanup exercise bricks
  const exerciseBrickErrors = await dojoDb.dojo_exercise_bricks_local
    .where("_status")
    .equals("error")
    .and((change) => change._timestamp < sevenDaysAgo)
    .toArray();

  if (exerciseBrickErrors.length > 0) {
    await dojoDb.dojo_exercise_bricks_local.bulkDelete(
      exerciseBrickErrors.map((c) => c._localId!)
    );
    logger.info("db.local", "Cleanup: Removed old exercise brick errors", {
      count: exerciseBrickErrors.length,
    });
  }
}
