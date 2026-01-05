/**
 * Exercises Cleanup Repository
 *
 * Auto-cleanup confirmed syncs and manage error states.
 */

import type { ExerciseTemplate, ExerciseVariant } from "@deeprecall/dojo-core";
import { dojoDb } from "../db";
import { logger } from "@deeprecall/telemetry";

let templateCleanupTimeout: ReturnType<typeof setTimeout> | null = null;
let variantCleanupTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Clean up local template changes that have been confirmed synced
 */
export async function cleanupSyncedExerciseTemplates(
  syncedTemplates: ExerciseTemplate[]
): Promise<void> {
  if (templateCleanupTimeout) {
    clearTimeout(templateCleanupTimeout);
  }

  templateCleanupTimeout = setTimeout(async () => {
    const syncedIds = new Set(syncedTemplates.map((t) => t.id as string));
    const localChanges = await dojoDb.dojo_exercise_templates_local.toArray();

    let deletedCount = 0;

    for (const localChange of localChanges) {
      if (syncedIds.has(localChange.id)) {
        if (localChange._op === "insert" || localChange._op === "update") {
          await dojoDb.dojo_exercise_templates_local.delete(
            localChange._localId!
          );
          deletedCount++;
        }
      } else {
        if (localChange._op === "delete") {
          await dojoDb.dojo_exercise_templates_local.delete(
            localChange._localId!
          );
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      logger.info("db.local", "Cleanup: Removed confirmed template changes", {
        count: deletedCount,
      });
    }
  }, 100);
}

/**
 * Clean up local variant changes that have been confirmed synced
 */
export async function cleanupSyncedExerciseVariants(
  syncedVariants: ExerciseVariant[]
): Promise<void> {
  if (variantCleanupTimeout) {
    clearTimeout(variantCleanupTimeout);
  }

  variantCleanupTimeout = setTimeout(async () => {
    const syncedIds = new Set(syncedVariants.map((v) => v.id as string));
    const localChanges = await dojoDb.dojo_exercise_variants_local.toArray();

    let deletedCount = 0;

    for (const localChange of localChanges) {
      if (syncedIds.has(localChange.id)) {
        if (localChange._op === "insert") {
          await dojoDb.dojo_exercise_variants_local.delete(
            localChange._localId!
          );
          deletedCount++;
        }
      } else {
        if (localChange._op === "delete") {
          await dojoDb.dojo_exercise_variants_local.delete(
            localChange._localId!
          );
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      logger.info("db.local", "Cleanup: Removed confirmed variant changes", {
        count: deletedCount,
      });
    }
  }, 100);
}

/**
 * Clean up old error states (>7 days)
 */
export async function cleanupOldExerciseErrors(): Promise<void> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // Cleanup templates
  const templateErrors = await dojoDb.dojo_exercise_templates_local
    .where("_status")
    .equals("error")
    .and((change) => change._timestamp < sevenDaysAgo)
    .toArray();

  if (templateErrors.length > 0) {
    await dojoDb.dojo_exercise_templates_local.bulkDelete(
      templateErrors.map((c) => c._localId!)
    );
    logger.info("db.local", "Cleanup: Removed old template errors", {
      count: templateErrors.length,
    });
  }

  // Cleanup variants
  const variantErrors = await dojoDb.dojo_exercise_variants_local
    .where("_status")
    .equals("error")
    .and((change) => change._timestamp < sevenDaysAgo)
    .toArray();

  if (variantErrors.length > 0) {
    await dojoDb.dojo_exercise_variants_local.bulkDelete(
      variantErrors.map((c) => c._localId!)
    );
    logger.info("db.local", "Cleanup: Removed old variant errors", {
      count: variantErrors.length,
    });
  }
}
