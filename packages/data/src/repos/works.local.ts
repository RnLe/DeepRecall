/**
 * Works Local Repository (Optimistic Layer)
 *
 * Handles immediate local writes for instant UI feedback.
 * Changes are stored in Dexie and enqueued for background sync.
 *
 * Responsibilities:
 * - Write to works_local table (instant)
 * - Enqueue changes to WriteBuffer (background sync)
 * - Track sync status (_status, _timestamp)
 */

import { db } from "../db";
import { WorkSchema, type Work } from "@deeprecall/core";
import { createWriteBuffer } from "../writeBuffer";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@deeprecall/telemetry";
import { isAuthenticated } from "../auth";

/**
 * Local change record with sync metadata
 */
export interface LocalWorkChange {
  _localId?: number; // Dexie auto-increment
  id: string; // Work ID
  _op: "insert" | "update" | "delete";
  _status: "pending" | "syncing" | "synced" | "error";
  _timestamp: number; // Local timestamp
  _error?: string; // Error message if sync failed

  // Work data (for insert/update)
  data?: Work;
}

const buffer = createWriteBuffer();

/**
 * Create a new work locally (optimistic)
 * Writes to local Dexie immediately, enqueues for sync
 */
export async function createWorkLocal(
  data: Omit<Work, "id" | "kind" | "createdAt" | "updatedAt">,
): Promise<Work> {
  const work: Work = WorkSchema.parse({
    ...data,
    id: uuidv4(),
    kind: "work",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 1. Write to local Dexie (instant)
  await db.works_local.add({
    id: work.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: work,
  });

  // 2. Enqueue for background sync (only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "works",
      op: "insert",
      payload: work,
    });
  }

  logger.info("db.local", "Created work (pending sync)", {
    workId: work.id,
    workType: work.workType,
    willSync: isAuthenticated(),
  });
  return work;
}

/**
 * Update a work locally (optimistic)
 */
export async function updateWorkLocal(
  id: string,
  updates: Partial<Work>,
): Promise<void> {
  const updatedData = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // 1. Update/add to local Dexie
  await db.works_local.put({
    id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: updatedData as any, // Partial data for update
  });

  // 2. Enqueue for background sync (only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "works",
      op: "update",
      payload: { id, ...updatedData },
    });
  }

  logger.info("db.local", "Updated work (pending sync)", {
    workId: id,
    fields: Object.keys(updates),
    willSync: isAuthenticated(),
  });
}

/**
 * Delete a work locally (optimistic)
 */
export async function deleteWorkLocal(id: string): Promise<void> {
  // 1. Mark as deleted in local Dexie
  await db.works_local.put({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
  });

  // 2. Enqueue for background sync (only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "works",
      op: "delete",
      payload: { id },
    });
  }

  logger.info("db.local", "Deleted work (pending sync)", {
    workId: id,
    willSync: isAuthenticated(),
  });
}

/**
 * Get all local pending changes
 */
export async function getLocalWorkChanges(): Promise<LocalWorkChange[]> {
  return db.works_local.toArray();
}

/**
 * Mark a local change as synced and remove it
 */
export async function markWorkSynced(id: string): Promise<void> {
  await db.works_local.where("id").equals(id).delete();
  logger.debug("db.local", "Cleaned up synced work", { workId: id });
}

/**
 * Mark a local change as failed
 */
export async function markWorkSyncFailed(
  id: string,
  error: string,
): Promise<void> {
  await db.works_local.where("id").equals(id).modify({
    _status: "error",
    _error: error,
  });
  logger.warn("db.local", "Work sync failed", { workId: id, error });
}
