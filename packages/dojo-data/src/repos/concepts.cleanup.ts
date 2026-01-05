/**
 * Concepts Cleanup Repository
 *
 * Auto-cleanup confirmed syncs and manage error states.
 * Called after Electric syncs data to remove local pending changes.
 */

import type { ConceptNode, ConceptNodeId } from "@deeprecall/dojo-core";
import { dojoDb } from "../db";
import { logger } from "@deeprecall/telemetry";

let cleanupTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Clean up local concept changes that have been confirmed synced
 * Debounced to prevent redundant runs from multiple hooks
 */
export async function cleanupSyncedConceptNodes(
  syncedNodes: ConceptNode[]
): Promise<void> {
  // Debounce cleanup (100ms)
  if (cleanupTimeout) {
    clearTimeout(cleanupTimeout);
  }

  cleanupTimeout = setTimeout(async () => {
    const syncedIds = new Set(syncedNodes.map((n) => n.id as string));
    const localChanges = await dojoDb.dojo_concept_nodes_local.toArray();

    let deletedCount = 0;

    for (const localChange of localChanges) {
      // If synced, cleanup based on operation
      if (syncedIds.has(localChange.id)) {
        if (localChange._op === "insert" || localChange._op === "update") {
          // Confirmed synced
          await dojoDb.dojo_concept_nodes_local.delete(localChange._localId!);
          deletedCount++;
        }
      } else {
        // Not in synced data
        if (localChange._op === "delete") {
          // Delete confirmed (not in synced data anymore)
          await dojoDb.dojo_concept_nodes_local.delete(localChange._localId!);
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      logger.info("db.local", "Cleanup: Removed confirmed concept changes", {
        count: deletedCount,
      });
    }
  }, 100);
}

/**
 * Clean up old error states (>7 days)
 */
export async function cleanupOldConceptErrors(): Promise<void> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const errorChanges = await dojoDb.dojo_concept_nodes_local
    .where("_status")
    .equals("error")
    .and((change) => change._timestamp < sevenDaysAgo)
    .toArray();

  if (errorChanges.length > 0) {
    await dojoDb.dojo_concept_nodes_local.bulkDelete(
      errorChanges.map((c) => c._localId!)
    );
    logger.info("db.local", "Cleanup: Removed old concept errors", {
      count: errorChanges.length,
    });
  }
}
