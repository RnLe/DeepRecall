/**
 * Repository for Activity entities (Electric + WriteBuffer version)
 * Read-path: Electric shapes syncing from Postgres
 * Write-path: WriteBuffer queue → /api/writes/batch → Postgres → Electric
 */

import type { Activity, ActivityExtended } from "@deeprecall/core";
import { ActivitySchema } from "@deeprecall/core";
import { useShape } from "../electric";
import { createWriteBuffer } from "../writeBuffer";
import { db } from "../db"; // Temporary for edges/extended queries

/**
 * React hook to get all Activities (live-synced from Postgres)
 */
export function useActivities() {
  return useShape<Activity>({
    table: "activities",
  });
}

/**
 * React hook to get a single Activity by ID
 */
export function useActivity(id: string | undefined) {
  const result = useShape<Activity>({
    table: "activities",
    where: id ? `id = '${id}'` : undefined,
  });

  return {
    ...result,
    data: result.data?.[0],
  };
}

/**
 * React hook to get Activities by type
 */
export function useActivitiesByType(activityType: string) {
  return useShape<Activity>({
    table: "activities",
    where: `activity_type = '${activityType}'`,
  });
}

/**
 * Get write buffer instance
 */
const buffer = createWriteBuffer();

/**
 * Create a new Activity (optimistic)
 */
export async function createActivity(
  data: Omit<Activity, "id" | "createdAt" | "updatedAt">
): Promise<Activity> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const activity: Activity = {
    ...data,
    id,
    kind: "activity",
    createdAt: now,
    updatedAt: now,
  };

  const validated = ActivitySchema.parse(activity);

  await buffer.enqueue({
    table: "activities",
    op: "insert",
    payload: validated,
  });

  console.log(`[ActivitiesRepo] Created activity ${id} (enqueued for sync)`);
  return validated;
}

/**
 * Update an Activity (optimistic)
 */
export async function updateActivity(
  id: string,
  updates: Partial<Omit<Activity, "id" | "kind" | "createdAt">>
): Promise<void> {
  const updated: Partial<Activity> = {
    id,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await buffer.enqueue({
    table: "activities",
    op: "update",
    payload: updated,
  });

  console.log(`[ActivitiesRepo] Updated activity ${id} (enqueued for sync)`);
}

/**
 * Delete an Activity (optimistic)
 */
export async function deleteActivity(id: string): Promise<void> {
  await buffer.enqueue({
    table: "activities",
    op: "delete",
    payload: { id },
  });

  console.log(`[ActivitiesRepo] Deleted activity ${id} (enqueued for sync)`);
}

/**
 * Search Activities by title (client-side filter)
 */
export function searchActivitiesByTitle(
  activities: Activity[],
  query: string
): Activity[] {
  const lowerQuery = query.toLowerCase();
  return activities.filter((activity) =>
    activity.title.toLowerCase().includes(lowerQuery)
  );
}

/**
 * List Activities within date range (client-side filter)
 */
export function listActivitiesInRange(
  activities: Activity[],
  startDate: string,
  endDate: string
): Activity[] {
  return activities.filter(
    (activity) =>
      (!!activity.startsAt &&
        activity.startsAt >= startDate &&
        activity.startsAt <= endDate) ||
      (!!activity.endsAt &&
        activity.endsAt >= startDate &&
        activity.endsAt <= endDate)
  );
}

/**
 * TEMPORARY: Get an Activity with contained entities (uses Dexie for edges)
 * Once Edges are migrated to Electric, this can use joins/shapes
 */
export async function getActivityExtended(
  id: string
): Promise<ActivityExtended | undefined> {
  const activity = await db.activities.get(id);
  if (!activity) return undefined;

  const containsEdges = await db.edges
    .where("fromId")
    .equals(id)
    .and((edge) => edge.relation === "contains")
    .toArray();

  const entityIds = containsEdges.map((edge) => edge.toId);
  const works = await db.works.where("id").anyOf(entityIds).toArray();
  const assets = await db.assets.where("id").anyOf(entityIds).toArray();

  return {
    ...activity,
    works,
    assets,
  };
}
