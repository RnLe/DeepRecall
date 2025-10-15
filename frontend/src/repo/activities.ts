/**
 * Repository for Activity entities
 * Encapsulates all Dexie operations for Activities
 */

import { db } from "@/src/db/dexie";
import type { Activity, ActivityExtended } from "@/src/schema/library";
import { ActivitySchema } from "@/src/schema/library";

/**
 * Create a new Activity
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

  // Validate before inserting
  const validated = ActivitySchema.parse(activity);
  await db.activities.add(validated);
  return validated;
}

/**
 * Get an Activity by ID
 */
export async function getActivity(id: string): Promise<Activity | undefined> {
  return db.activities.get(id);
}

/**
 * Get an Activity by ID with contained entities (via edges)
 */
export async function getActivityExtended(
  id: string
): Promise<ActivityExtended | undefined> {
  const activity = await db.activities.get(id);
  if (!activity) return undefined;

  // Find edges where activity contains other entities
  const containsEdges = await db.edges
    .where("fromId")
    .equals(id)
    .and((edge) => edge.relation === "contains")
    .toArray();

  const entityIds = containsEdges.map((edge) => edge.toId);

  // Resolve entities
  const works = await db.works.where("id").anyOf(entityIds).toArray();
  const versions = await db.versions.where("id").anyOf(entityIds).toArray();
  const assets = await db.assets.where("id").anyOf(entityIds).toArray();

  return {
    ...activity,
    works,
    versions,
    assets,
  };
}

/**
 * List all Activities
 */
export async function listActivities(): Promise<Activity[]> {
  return db.activities.toArray();
}

/**
 * Update an Activity
 */
export async function updateActivity(
  id: string,
  updates: Partial<Omit<Activity, "id" | "kind" | "createdAt">>
): Promise<Activity | undefined> {
  const activity = await db.activities.get(id);
  if (!activity) return undefined;

  const updated: Activity = {
    ...activity,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Validate before updating
  const validated = ActivitySchema.parse(updated);
  await db.activities.update(id, validated);
  return validated;
}

/**
 * Delete an Activity
 */
export async function deleteActivity(id: string): Promise<void> {
  // Delete edges involving this activity
  await db.edges.where("fromId").equals(id).delete();
  await db.edges.where("toId").equals(id).delete();

  // Delete the activity
  await db.activities.delete(id);
}

/**
 * List Activities by type
 */
export async function listActivitiesByType(
  activityType: string
): Promise<Activity[]> {
  return db.activities.where("activityType").equals(activityType).toArray();
}

/**
 * Search Activities by title
 */
export async function searchActivitiesByTitle(
  query: string
): Promise<Activity[]> {
  const lowerQuery = query.toLowerCase();
  return db.activities
    .filter((activity) => activity.title.toLowerCase().includes(lowerQuery))
    .toArray();
}

/**
 * List Activities within a date range
 */
export async function listActivitiesInRange(
  startDate: string,
  endDate: string
): Promise<Activity[]> {
  return db.activities
    .filter(
      (activity) =>
        (!!activity.startsAt &&
          activity.startsAt >= startDate &&
          activity.startsAt <= endDate) ||
        (!!activity.endsAt &&
          activity.endsAt >= startDate &&
          activity.endsAt <= endDate)
    )
    .toArray();
}

/**
 * List active Activities (currently ongoing)
 */
export async function listActiveActivities(): Promise<Activity[]> {
  const now = new Date().toISOString();
  return db.activities
    .filter(
      (activity) =>
        !!activity.startsAt &&
        activity.startsAt <= now &&
        (!activity.endsAt || activity.endsAt >= now)
    )
    .toArray();
}

/**
 * List upcoming Activities
 */
export async function listUpcomingActivities(): Promise<Activity[]> {
  const now = new Date().toISOString();
  return db.activities
    .filter((activity) => !!activity.startsAt && activity.startsAt > now)
    .toArray();
}

/**
 * List past Activities
 */
export async function listPastActivities(): Promise<Activity[]> {
  const now = new Date().toISOString();
  return db.activities
    .filter((activity) => !!activity.endsAt && activity.endsAt < now)
    .toArray();
}
