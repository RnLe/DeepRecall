/**
 * Strokes Merged Repository (Read Layer)
 *
 * Combines synced data from Electric with local optimistic changes
 * for instant UI feedback
 */

import { db } from "../db";
import type { Stroke } from "@deeprecall/core";
import { liveQuery } from "dexie";

/**
 * Get all strokes for a board (merged view: synced + local)
 */
export async function getMergedStrokesByBoard(
  boardId: string
): Promise<Stroke[]> {
  // 1. Get synced strokes from Electric
  const syncedStrokes = await db.strokes
    .where("boardId")
    .equals(boardId)
    .toArray();

  // 2. Get local changes (pending sync)
  const localChanges = await db.strokes_local.toArray();

  // 3. Build map of synced strokes
  const strokesMap = new Map<string, Stroke>();
  syncedStrokes.forEach((stroke) => strokesMap.set(stroke.id, stroke));

  // 4. Apply local changes (filter by boardId)
  for (const change of localChanges) {
    if (change.data?.boardId === boardId) {
      if (change._op === "delete") {
        strokesMap.delete(change.id);
      } else if (change.data) {
        strokesMap.set(change.id, change.data);
      }
    } else if (change._op === "delete") {
      // Delete tombstone - remove if exists
      strokesMap.delete(change.id);
    }
  }

  // 5. Return merged array sorted by creation time
  return Array.from(strokesMap.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

/**
 * Get a single stroke by ID (merged view)
 */
export async function getMergedStrokeById(id: string): Promise<Stroke | null> {
  // Check local changes first (most recent)
  const localChanges = await db.strokes_local.where({ id }).toArray();
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
  return (await db.strokes.get(id)) || null;
}

/**
 * Live query for board strokes (reactive)
 */
export function liveQueryStrokesByBoard(boardId: string) {
  return liveQuery(() => getMergedStrokesByBoard(boardId));
}
