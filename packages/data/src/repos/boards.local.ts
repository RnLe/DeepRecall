/**
 * Boards Local Repository (Optimistic Layer)
 *
 * Handles immediate local writes for instant UI feedback.
 * Changes are stored in Dexie and enqueued for background sync.
 */

import { db } from "../db";
import { BoardSchema, type Board } from "@deeprecall/core";
import { createWriteBuffer } from "../writeBuffer";
import { v4 as uuidv4 } from "uuid";

export interface LocalBoardChange {
  _localId?: number;
  id: string;
  _op: "insert" | "update" | "delete";
  _status: "pending" | "syncing" | "synced" | "error";
  _timestamp: number;
  _error?: string;
  data?: Board;
}

const buffer = createWriteBuffer();

/**
 * Create a new board locally (optimistic)
 */
export async function createBoardLocal(
  data: Omit<Board, "id" | "kind" | "createdAt" | "updatedAt">
): Promise<Board> {
  const board: Board = BoardSchema.parse({
    ...data,
    id: uuidv4(),
    kind: "board",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 1. Write to local Dexie (instant)
  const change: LocalBoardChange = {
    id: board.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: board,
  };

  await db.boards_local.add(change);
  console.log(`[Board Local] Created board locally: ${board.id}`);

  // 2. Enqueue for background sync
  await buffer.enqueue({
    table: "boards",
    op: "insert",
    payload: board,
  });

  return board;
}

/**
 * Update a board locally (optimistic)
 */
export async function updateBoardLocal(
  id: string,
  updates: Partial<Omit<Board, "id" | "kind" | "createdAt">>
): Promise<void> {
  // Get existing board (check both synced and local)
  const syncedBoard = await db.boards.get(id);
  const localChanges = await db.boards_local.where({ id }).toArray();
  const existingLocal = localChanges.find((c) => c._op !== "delete");

  if (!syncedBoard && !existingLocal) {
    throw new Error(`Board ${id} not found`);
  }

  const currentData = existingLocal?.data || syncedBoard;
  if (!currentData) {
    throw new Error(`Board ${id} has no data`);
  }

  const updatedBoard: Board = {
    ...currentData,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // 1. Write to local Dexie (instant)
  const change: LocalBoardChange = {
    id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: updatedBoard,
  };

  await db.boards_local.add(change);
  console.log(`[Board Local] Updated board locally: ${id}`);

  // 2. Enqueue for background sync
  await buffer.enqueue({
    table: "boards",
    op: "update",
    payload: updatedBoard,
  });
}

/**
 * Delete a board locally (optimistic)
 */
export async function deleteBoardLocal(id: string): Promise<void> {
  // 1. Write tombstone to local Dexie (instant)
  const change: LocalBoardChange = {
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
  };

  await db.boards_local.add(change);
  console.log(`[Board Local] Deleted board locally: ${id}`);

  // 2. Enqueue for background sync
  await buffer.enqueue({
    table: "boards",
    op: "delete",
    payload: { id },
  });
}
