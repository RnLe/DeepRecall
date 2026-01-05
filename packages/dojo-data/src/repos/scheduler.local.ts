/**
 * Scheduler Local Repository (Optimistic Layer)
 *
 * Instant writes to Dexie, queued for background sync via WriteBuffer.
 */

import type {
  SchedulerItem,
  SchedulerItemCreate,
  SchedulerItemId,
  AttemptId,
} from "@deeprecall/dojo-core";
import { asSchedulerItemId } from "@deeprecall/dojo-core";
import { createWriteBuffer, isAuthenticated } from "@deeprecall/data";
import { logger } from "@deeprecall/telemetry";
import { dojoDb } from "../db";
import { schedulerItemToRow } from "../mappers";
import type { DojoSchedulerItemRow } from "../types/rows";

const buffer = createWriteBuffer();

/**
 * Create a new scheduler item (instant local write)
 */
export async function createSchedulerItemLocal(
  input: SchedulerItemCreate,
  ownerId: string
): Promise<SchedulerItem> {
  const now = new Date().toISOString();
  const id = asSchedulerItemId(crypto.randomUUID());

  const item: SchedulerItem = {
    ...input,
    id,
    completed: false,
    createdAt: now,
  };

  const row = schedulerItemToRow(item);
  row.owner_id = ownerId;

  // Write to local table (instant)
  await dojoDb.dojo_scheduler_items_local.add({
    id: item.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: row,
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_scheduler_items",
      op: "insert",
      payload: row,
    });
  }

  logger.info("db.local", "Created scheduler item (pending sync)", {
    itemId: id,
    templateId: input.templateId,
    scheduledFor: input.scheduledFor,
    willSync: isAuthenticated(),
  });

  return item;
}

/**
 * Create multiple scheduler items (instant local write)
 */
export async function createSchedulerItemsLocal(
  inputs: SchedulerItemCreate[],
  ownerId: string
): Promise<SchedulerItem[]> {
  const now = new Date().toISOString();
  const items: SchedulerItem[] = [];

  for (const input of inputs) {
    const id = asSchedulerItemId(crypto.randomUUID());
    const item: SchedulerItem = {
      ...input,
      id,
      completed: false,
      createdAt: now,
    };
    items.push(item);

    const row = schedulerItemToRow(item);
    row.owner_id = ownerId;

    // Write to local table (instant)
    await dojoDb.dojo_scheduler_items_local.add({
      id: item.id,
      _op: "insert",
      _status: "pending",
      _timestamp: Date.now(),
      data: row,
    });

    // Enqueue for server sync (background, only if authenticated)
    if (isAuthenticated()) {
      await buffer.enqueue({
        table: "dojo_scheduler_items",
        op: "insert",
        payload: row,
      });
    }
  }

  logger.info("db.local", "Created scheduler items (pending sync)", {
    count: items.length,
    willSync: isAuthenticated(),
  });

  return items;
}

/**
 * Complete a scheduler item (instant local write)
 */
export async function completeSchedulerItemLocal(
  id: SchedulerItemId,
  attemptId: AttemptId | undefined,
  ownerId: string
): Promise<void> {
  const now = new Date().toISOString();

  const payload = {
    id,
    owner_id: ownerId,
    completed: true,
    completed_at: now,
    completed_by_attempt_id: attemptId ?? null,
  };

  // Write to local table (instant)
  await dojoDb.dojo_scheduler_items_local.add({
    id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: payload as any, // Partial update
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_scheduler_items",
      op: "update",
      payload,
    });
  }

  logger.info("db.local", "Completed scheduler item (pending sync)", {
    itemId: id,
    attemptId,
    willSync: isAuthenticated(),
  });
}

/**
 * Reschedule an item (instant local write)
 */
export async function rescheduleItemLocal(
  id: SchedulerItemId,
  newScheduledFor: string,
  newReason: SchedulerItem["reason"],
  ownerId: string
): Promise<void> {
  const payload = {
    id,
    owner_id: ownerId,
    scheduled_for: newScheduledFor,
    reason: newReason,
    completed: false,
    completed_at: null,
    completed_by_attempt_id: null,
  };

  // Write to local table (instant)
  await dojoDb.dojo_scheduler_items_local.add({
    id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: payload as any, // Partial update
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_scheduler_items",
      op: "update",
      payload,
    });
  }

  logger.info("db.local", "Rescheduled scheduler item (pending sync)", {
    itemId: id,
    newScheduledFor,
    newReason,
    willSync: isAuthenticated(),
  });
}

/**
 * Update scheduler item priority (instant local write)
 */
export async function updateSchedulerItemPriorityLocal(
  id: SchedulerItemId,
  priority: number,
  ownerId: string
): Promise<void> {
  const payload = {
    id,
    owner_id: ownerId,
    priority,
  };

  // Write to local table (instant)
  await dojoDb.dojo_scheduler_items_local.add({
    id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: payload as any, // Partial update
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_scheduler_items",
      op: "update",
      payload,
    });
  }

  logger.info("db.local", "Updated scheduler item priority (pending sync)", {
    itemId: id,
    priority,
    willSync: isAuthenticated(),
  });
}

/**
 * Delete a scheduler item (instant local write)
 */
export async function deleteSchedulerItemLocal(
  id: SchedulerItemId,
  ownerId: string
): Promise<void> {
  // Write to local table (instant)
  await dojoDb.dojo_scheduler_items_local.add({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_scheduler_items",
      op: "delete",
      payload: { id, owner_id: ownerId },
    });
  }

  logger.info("db.local", "Deleted scheduler item (pending sync)", {
    itemId: id,
    willSync: isAuthenticated(),
  });
}
