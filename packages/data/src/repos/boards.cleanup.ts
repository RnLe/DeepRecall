/**
 * Boards Cleanup Repository
 *
 * Removes local changes after they've been confirmed by Electric
 */

import { db } from "../db";

/**
 * Clean up local changes that have been synced
 * Called after Electric confirms the changes
 */
export async function cleanupBoardsLocal(syncedIds: string[]): Promise<void> {
  if (syncedIds.length === 0) return;

  const idsSet = new Set(syncedIds);

  // Get all local changes
  const localChanges = await db.boards_local.toArray();

  // Find changes for synced IDs
  const toDelete = localChanges
    .filter((change) => idsSet.has(change.id))
    .map((change) => change._localId!)
    .filter((id) => id !== undefined);

  if (toDelete.length > 0) {
    await db.boards_local.bulkDelete(toDelete);
    console.log(`[Boards Cleanup] Removed ${toDelete.length} synced change(s)`);
  }
}

/**
 * Clean up all successful local changes
 */
export async function cleanupAllSyncedBoards(): Promise<void> {
  const synced = await db.boards_local
    .where("_status")
    .equals("synced")
    .toArray();

  if (synced.length > 0) {
    const ids = synced.map((c) => c._localId!).filter((id) => id !== undefined);
    await db.boards_local.bulkDelete(ids);
    console.log(
      `[Boards Cleanup] Removed ${ids.length} synced local change(s)`
    );
  }
}
