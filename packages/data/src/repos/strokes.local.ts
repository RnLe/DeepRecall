/**
 * Strokes Local Repository (Optimistic Layer)
 *
 * Handles immediate local writes for instant UI feedback.
 * Changes are stored in Dexie and enqueued for background sync.
 */

import { db } from "../db";
import { StrokeSchema, type Stroke } from "@deeprecall/core";
import { createWriteBuffer } from "../writeBuffer";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@deeprecall/telemetry";

export interface LocalStrokeChange {
  _localId?: number;
  id: string;
  _op: "insert" | "update" | "delete";
  _status: "pending" | "syncing" | "synced" | "error";
  _timestamp: number;
  _error?: string;
  data?: Stroke;
}

const buffer = createWriteBuffer();

/**
 * Create a new stroke locally (optimistic)
 */
export async function createStrokeLocal(
  data: Omit<Stroke, "id" | "kind" | "createdAt" | "updatedAt">
): Promise<Stroke> {
  const stroke: Stroke = StrokeSchema.parse({
    ...data,
    id: uuidv4(),
    kind: "stroke",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 1. Write to local Dexie (instant)
  const change: LocalStrokeChange = {
    id: stroke.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: stroke,
  };

  await db.strokes_local.add(change);
  logger.info("ink", "Created stroke locally", {
    strokeId: stroke.id,
    boardId: stroke.boardId,
  });

  // 2. Enqueue for background sync
  await buffer.enqueue({
    table: "strokes",
    op: "insert",
    payload: stroke,
  });

  return stroke;
}

/**
 * Delete a stroke locally (optimistic)
 * Used by eraser tool
 */
export async function deleteStrokeLocal(id: string): Promise<void> {
  // 1. Write tombstone to local Dexie (instant)
  const change: LocalStrokeChange = {
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
  };

  await db.strokes_local.add(change);
  logger.info("ink", "Deleted stroke locally", { strokeId: id });

  // 2. Enqueue for background sync
  await buffer.enqueue({
    table: "strokes",
    op: "delete",
    payload: { id },
  });
}

/**
 * Batch delete strokes (for eraser)
 */
export async function deleteStrokesLocal(ids: string[]): Promise<void> {
  const timestamp = Date.now();

  // 1. Write tombstones to local Dexie
  const changes: LocalStrokeChange[] = ids.map((id) => ({
    id,
    _op: "delete" as const,
    _status: "pending" as const,
    _timestamp: timestamp,
  }));

  await db.strokes_local.bulkAdd(changes);
  logger.info("ink", "Batch deleted strokes locally", { count: ids.length });

  // 2. Enqueue for background sync
  for (const id of ids) {
    await buffer.enqueue({
      table: "strokes",
      op: "delete",
      payload: { id },
    });
  }
}
