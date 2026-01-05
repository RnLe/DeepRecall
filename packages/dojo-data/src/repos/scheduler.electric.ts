/**
 * Scheduler Electric Repository
 *
 * Read-path: Electric shapes syncing from Postgres
 * Write-path: WriteBuffer queue → /api/writes/batch → Postgres → Electric
 */

import type {
  SchedulerItem,
  SchedulerItemCreate,
  SchedulerItemId,
  ExerciseTemplateId,
  AttemptId,
} from "@deeprecall/dojo-core";
import { asSchedulerItemId } from "@deeprecall/dojo-core";
import { useShape, createWriteBuffer } from "@deeprecall/data";
import { logger } from "@deeprecall/telemetry";
import type { DojoSchedulerItemRow } from "../types/rows";
import { schedulerItemToDomain, schedulerItemToRow } from "../mappers";

// =============================================================================
// Electric Read Hooks
// =============================================================================

/**
 * React hook to get all scheduler items for a user
 * @param userId - Owner filter for multi-tenant isolation
 */
export function useSchedulerItems(userId?: string) {
  const result = useShape<DojoSchedulerItemRow>({
    table: "dojo_scheduler_items",
    where: userId ? `owner_id = '${userId}'` : undefined,
  });

  return {
    ...result,
    data: result.data?.map(schedulerItemToDomain),
  };
}

/**
 * React hook to get pending (uncompleted) scheduler items
 */
export function usePendingSchedulerItems(userId?: string) {
  const whereClause = userId
    ? `owner_id = '${userId}' AND completed = false`
    : `completed = false`;

  const result = useShape<DojoSchedulerItemRow>({
    table: "dojo_scheduler_items",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.map(schedulerItemToDomain),
  };
}

/**
 * React hook to get due scheduler items (scheduled_for <= now)
 */
export function useDueSchedulerItems(userId?: string) {
  const now = new Date().toISOString();
  const whereClause = userId
    ? `owner_id = '${userId}' AND completed = false AND scheduled_for <= '${now}'`
    : `completed = false AND scheduled_for <= '${now}'`;

  const result = useShape<DojoSchedulerItemRow>({
    table: "dojo_scheduler_items",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.map(schedulerItemToDomain),
  };
}

/**
 * React hook to get scheduler items for a specific template
 */
export function useSchedulerItemsByTemplate(
  templateId: ExerciseTemplateId,
  userId?: string
) {
  const whereClause = userId
    ? `owner_id = '${userId}' AND template_id = '${templateId}'`
    : `template_id = '${templateId}'`;

  const result = useShape<DojoSchedulerItemRow>({
    table: "dojo_scheduler_items",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.map(schedulerItemToDomain),
  };
}

/**
 * React hook to get a single scheduler item by ID
 */
export function useSchedulerItem(id: SchedulerItemId | undefined) {
  const result = useShape<DojoSchedulerItemRow>({
    table: "dojo_scheduler_items",
    where: id ? `id = '${id}'` : undefined,
  });

  return {
    ...result,
    data: result.data?.[0] ? schedulerItemToDomain(result.data[0]) : undefined,
  };
}

/**
 * React hook to get items scheduled for today
 */
export function useTodaySchedulerItems(userId?: string) {
  const today = new Date();
  const startOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).toISOString();
  const endOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1
  ).toISOString();

  const whereClause = userId
    ? `owner_id = '${userId}' AND completed = false AND scheduled_for >= '${startOfDay}' AND scheduled_for < '${endOfDay}'`
    : `completed = false AND scheduled_for >= '${startOfDay}' AND scheduled_for < '${endOfDay}'`;

  const result = useShape<DojoSchedulerItemRow>({
    table: "dojo_scheduler_items",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.map(schedulerItemToDomain),
  };
}

// =============================================================================
// Write Operations
// =============================================================================

const buffer = createWriteBuffer();

/**
 * Create a new scheduler item
 */
export async function createSchedulerItem(
  data: SchedulerItemCreate,
  ownerId: string
): Promise<SchedulerItem> {
  const now = new Date().toISOString();
  const id = asSchedulerItemId(crypto.randomUUID());

  const item: SchedulerItem = {
    ...data,
    id,
    completed: false,
    createdAt: now,
  };

  const row = schedulerItemToRow(item);
  row.owner_id = ownerId;

  await buffer.enqueue({
    table: "dojo_scheduler_items",
    op: "insert",
    payload: row,
  });

  logger.info("srs", "Created scheduler item (enqueued)", {
    itemId: id,
    templateId: data.templateId,
    scheduledFor: data.scheduledFor,
    reason: data.reason,
  });

  return item;
}

/**
 * Mark a scheduler item as completed
 */
export async function completeSchedulerItem(
  id: SchedulerItemId,
  attemptId: AttemptId,
  ownerId: string
): Promise<void> {
  const now = new Date().toISOString();

  await buffer.enqueue({
    table: "dojo_scheduler_items",
    op: "update",
    payload: {
      id,
      owner_id: ownerId,
      completed: true,
      completed_at: now,
      completed_by_attempt_id: attemptId,
    },
  });

  logger.info("srs", "Completed scheduler item (enqueued)", {
    itemId: id,
    attemptId,
  });
}

/**
 * Reschedule an item
 */
export async function rescheduleItem(
  id: SchedulerItemId,
  newScheduledFor: string,
  ownerId: string
): Promise<void> {
  await buffer.enqueue({
    table: "dojo_scheduler_items",
    op: "update",
    payload: {
      id,
      owner_id: ownerId,
      scheduled_for: newScheduledFor,
    },
  });

  logger.info("srs", "Rescheduled item (enqueued)", {
    itemId: id,
    newScheduledFor,
  });
}

/**
 * Update priority of a scheduler item
 */
export async function updateSchedulerItemPriority(
  id: SchedulerItemId,
  priority: number,
  ownerId: string
): Promise<void> {
  await buffer.enqueue({
    table: "dojo_scheduler_items",
    op: "update",
    payload: {
      id,
      owner_id: ownerId,
      priority,
    },
  });

  logger.info("srs", "Updated priority (enqueued)", {
    itemId: id,
    priority,
  });
}

/**
 * Delete a scheduler item
 */
export async function deleteSchedulerItem(
  id: SchedulerItemId,
  ownerId: string
): Promise<void> {
  await buffer.enqueue({
    table: "dojo_scheduler_items",
    op: "delete",
    payload: { id, owner_id: ownerId },
  });

  logger.info("srs", "Deleted scheduler item (enqueued)", {
    itemId: id,
  });
}

/**
 * Create multiple scheduler items at once
 */
export async function createSchedulerItems(
  items: SchedulerItemCreate[],
  ownerId: string
): Promise<SchedulerItem[]> {
  const now = new Date().toISOString();
  const createdItems: SchedulerItem[] = [];

  for (const data of items) {
    const id = asSchedulerItemId(crypto.randomUUID());

    const item: SchedulerItem = {
      ...data,
      id,
      completed: false,
      createdAt: now,
    };

    const row = schedulerItemToRow(item);
    row.owner_id = ownerId;

    await buffer.enqueue({
      table: "dojo_scheduler_items",
      op: "insert",
      payload: row,
    });

    createdItems.push(item);
  }

  logger.info("srs", "Created scheduler items (enqueued)", {
    count: items.length,
  });

  return createdItems;
}
