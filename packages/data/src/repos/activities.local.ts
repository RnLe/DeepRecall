/**
 * Activities Local Repository (Optimistic Layer)
 *
 * Handles immediate local writes for instant UI feedback.
 * Changes are stored in Dexie and enqueued for background sync.
 *
 * Responsibilities:
 * - Write to activities_local table (instant)
 * - Enqueue changes to WriteBuffer (background sync)
 * - Track sync status (_status, _timestamp)
 */

import { db } from "../db";
import { ActivitySchema, type Activity } from "@deeprecall/core";
import { createWriteBuffer } from "../writeBuffer";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@deeprecall/telemetry";
import { isAuthenticated } from "../auth";

/**
 * Local change record with sync metadata
 */
export interface LocalActivityChange {
  _localId?: number; // Dexie auto-increment
  id: string; // Activity ID
  _op: "insert" | "update" | "delete";
  _status: "pending" | "syncing" | "synced" | "error";
  _timestamp: number; // Local timestamp
  _error?: string; // Error message if sync failed

  // Activity data (for insert/update)
  data?: Activity;
}

const buffer = createWriteBuffer();

/**
 * Create a new activity locally (optimistic)
 * Writes to local Dexie immediately, enqueues for sync
 */
export async function createActivityLocal(
  data: Omit<Activity, "id" | "kind" | "createdAt" | "updatedAt">
): Promise<Activity> {
  const activity: Activity = ActivitySchema.parse({
    ...data,
    id: uuidv4(),
    kind: "activity",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 1. Write to local Dexie (instant)
  await db.activities_local.add({
    id: activity.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: activity,
  });

  // 2. Enqueue for background sync (only if authenticated)

  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "activities",
      op: "insert",
      payload: activity,
    });
  }

  logger.info("db.local", "Created activity (pending sync)", {
    activityId: activity.id,
    activityType: activity.activityType,
    willSync: isAuthenticated(),
  });
  return activity;
}

/**
 * Update an activity locally (optimistic)
 */
export async function updateActivityLocal(
  id: string,
  updates: Partial<Activity>
): Promise<void> {
  const updatedData = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // 1. Update/add to local Dexie
  await db.activities_local.put({
    id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: updatedData as any, // Partial data for update
  });

  // 2. Enqueue for background sync (only if authenticated)

  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "activities",
      op: "update",
      payload: { id, ...updatedData },
    });
  }

  logger.info("db.local", "Updated activity (pending sync)", {
    activityId: id,
    fields: Object.keys(updates),
    willSync: isAuthenticated(),
  });
}

/**
 * Delete an activity locally (optimistic)
 */
export async function deleteActivityLocal(id: string): Promise<void> {
  // 1. Mark as deleted in local Dexie
  await db.activities_local.put({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
  });

  // 2. Enqueue for background sync (only if authenticated)

  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "activities",
      op: "delete",
      payload: { id },
    });
  }

  logger.info("db.local", "Deleted activity (pending sync)", {
    activityId: id,
    willSync: isAuthenticated(),
  });
}

/**
 * Get all local pending changes
 */
export async function getLocalActivityChanges(): Promise<
  LocalActivityChange[]
> {
  return db.activities_local.toArray();
}

/**
 * Mark a local change as synced and remove it
 */
export async function markActivitySynced(id: string): Promise<void> {
  await db.activities_local.where("id").equals(id).delete();
  logger.debug("db.local", "Cleaned up synced activity", {
    activityId: id,
    willSync: isAuthenticated(),
  });
}

/**
 * Mark a local change as failed
 */
export async function markActivitySyncFailed(
  id: string,
  error: string
): Promise<void> {
  await db.activities_local.where("id").equals(id).modify({
    _status: "error",
    _error: error,
  });
  logger.warn("db.local", "Activity sync failed", { activityId: id, error });
}
