/**
 * Repository for Collection entities
 * Encapsulates all Dexie operations for Collections
 */

import { db } from "@deeprecall/data/db";
import type { Collection, CollectionExtended } from "@deeprecall/core";
import { CollectionSchema } from "@deeprecall/core";

/**
 * Create a new Collection
 */
export async function createCollection(
  data: Omit<Collection, "id" | "createdAt" | "updatedAt">
): Promise<Collection> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const collection: Collection = {
    ...data,
    id,
    kind: "collection",
    createdAt: now,
    updatedAt: now,
  };

  // Validate before inserting
  const validated = CollectionSchema.parse(collection);
  await db.collections.add(validated);
  return validated;
}

/**
 * Get a Collection by ID
 */
export async function getCollection(
  id: string
): Promise<Collection | undefined> {
  return db.collections.get(id);
}

/**
 * Get a Collection by ID with contained entities (via edges)
 */
export async function getCollectionExtended(
  id: string
): Promise<CollectionExtended | undefined> {
  const collection = await db.collections.get(id);
  if (!collection) return undefined;

  // Find edges where collection contains other entities
  const containsEdges = await db.edges
    .where("fromId")
    .equals(id)
    .and((edge) => edge.relation === "contains")
    .toArray();

  // Sort by order if collection is ordered
  if (collection.ordered) {
    containsEdges.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  const entityIds = containsEdges.map((edge) => edge.toId);

  // Resolve entities
  const works = await db.works.where("id").anyOf(entityIds).toArray();
  const versions = await db.versions.where("id").anyOf(entityIds).toArray();
  const activities = await db.activities.where("id").anyOf(entityIds).toArray();

  return {
    ...collection,
    works,
    versions,
    activities,
  };
}

/**
 * List all Collections
 */
export async function listCollections(): Promise<Collection[]> {
  return db.collections.toArray();
}

/**
 * Update a Collection
 */
export async function updateCollection(
  id: string,
  updates: Partial<Omit<Collection, "id" | "kind" | "createdAt">>
): Promise<Collection | undefined> {
  const collection = await db.collections.get(id);
  if (!collection) return undefined;

  const updated: Collection = {
    ...collection,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Validate before updating
  const validated = CollectionSchema.parse(updated);
  await db.collections.update(id, validated);
  return validated;
}

/**
 * Delete a Collection
 */
export async function deleteCollection(id: string): Promise<void> {
  // Delete edges involving this collection
  await db.edges.where("fromId").equals(id).delete();
  await db.edges.where("toId").equals(id).delete();

  // Delete the collection
  await db.collections.delete(id);
}

/**
 * Search Collections by name
 */
export async function searchCollectionsByName(
  query: string
): Promise<Collection[]> {
  const lowerQuery = query.toLowerCase();
  return db.collections
    .filter((collection) => collection.name.toLowerCase().includes(lowerQuery))
    .toArray();
}

/**
 * List private Collections
 */
export async function listPrivateCollections(): Promise<Collection[]> {
  return db.collections.where("isPrivate").equals(1).toArray();
}

/**
 * List public Collections
 */
export async function listPublicCollections(): Promise<Collection[]> {
  return db.collections.where("isPrivate").equals(0).toArray();
}

/**
 * List Collections with a specific tag
 */
export async function listCollectionsByTag(tag: string): Promise<Collection[]> {
  return db.collections
    .filter((collection) => collection.tags.includes(tag))
    .toArray();
}
