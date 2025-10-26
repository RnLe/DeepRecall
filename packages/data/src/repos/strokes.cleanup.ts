/**
 * Strokes Cleanup Repository
 *
 * Removes local changes after they've been confirmed by Electric
 */

import { db } from "../db";

/**
 * Clean up local changes that have been synced
 */
export async function cleanupStrokesLocal(syncedIds: string[]): Promise<void> {
  if (syncedIds.length === 0) return;

  const idsSet = new Set(syncedIds);

  // Get all local changes
  const localChanges = await db.strokes_local.toArray();

  // Find changes for synced IDs
  const toDelete = localChanges
    .filter((change) => idsSet.has(change.id))
    .map((change) => change._localId!)
    .filter((id) => id !== undefined);

  if (toDelete.length > 0) {
    await db.strokes_local.bulkDelete(toDelete);
    console.log(
      `[Strokes Cleanup] Removed ${toDelete.length} synced change(s)`
    );
  }
}

/**
 * Clean up all successful local changes
 */
export async function cleanupAllSyncedStrokes(): Promise<void> {
  const synced = await db.strokes_local
    .where("_status")
    .equals("synced")
    .toArray();

  if (synced.length > 0) {
    const ids = synced.map((c) => c._localId!).filter((id) => id !== undefined);
    await db.strokes_local.bulkDelete(ids);
    console.log(
      `[Strokes Cleanup] Removed ${ids.length} synced local change(s)`
    );
  }
}
