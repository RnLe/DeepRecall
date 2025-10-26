/**
 * Boards Merged Repository (Read Layer)
 *
 * Combines synced data from Electric with local optimistic changes
 * for instant UI feedback
 */

import { db } from "../db";
import type { Board } from "@deeprecall/core";
import { liveQuery } from "dexie";

/**
 * Get all boards (merged view: synced + local)
 * Local changes override synced data
 */
export async function getAllMergedBoards(): Promise<Board[]> {
  // 1. Get synced boards from Electric
  const syncedBoards = await db.boards.toArray();

  // 2. Get local changes (pending sync)
  const localChanges = await db.boards_local.toArray();

  // 3. Build map of synced boards
  const boardsMap = new Map<string, Board>();
  syncedBoards.forEach((board) => boardsMap.set(board.id, board));

  // 4. Apply local changes
  for (const change of localChanges) {
    if (change._op === "delete") {
      boardsMap.delete(change.id);
    } else if (change.data) {
      boardsMap.set(change.id, change.data);
    }
  }

  // 5. Return merged array
  return Array.from(boardsMap.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Get a single board by ID (merged view)
 */
export async function getMergedBoardById(id: string): Promise<Board | null> {
  // Check local changes first (most recent)
  const localChanges = await db.boards_local.where({ id }).toArray();
  const latestLocal = localChanges
    .sort((a, b) => b._timestamp - a._timestamp)
    .find((c) => c._op !== "delete");

  if (latestLocal?.data) {
    return latestLocal.data;
  }

  // Check for delete tombstone
  const hasDeleteTombstone = localChanges.some((c) => c._op === "delete");
  if (hasDeleteTombstone) {
    return null;
  }

  // Fall back to synced data
  return (await db.boards.get(id)) || null;
}

/**
 * Live query for all boards (reactive)
 */
export function liveQueryAllBoards() {
  return liveQuery(() => getAllMergedBoards());
}

/**
 * Live query for single board (reactive)
 */
export function liveQueryBoard(id: string) {
  return liveQuery(() => getMergedBoardById(id));
}
