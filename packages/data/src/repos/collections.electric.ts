/**
 * Repository for Collection entities (Electric + WriteBuffer version)
 */

import type { Collection } from "@deeprecall/core";
import { CollectionSchema } from "@deeprecall/core";
import { useShape } from "../electric";
import { createWriteBuffer } from "../writeBuffer";
import { logger } from "@deeprecall/telemetry";

export function useCollections(userId?: string) {
  return useShape<Collection>({
    table: "collections",
    where: userId ? `owner_id = '${userId}'` : undefined,
  });
}

export function useCollection(id: string | undefined) {
  const result = useShape<Collection>({
    table: "collections",
    where: id ? `id = '${id}'` : undefined,
  });
  return { ...result, data: result.data?.[0] };
}

export function usePublicCollections() {
  return useShape<Collection>({
    table: "collections",
    where: "is_private = false",
  });
}

const buffer = createWriteBuffer();

export async function createCollection(
  data: Omit<Collection, "id" | "createdAt" | "updatedAt">
): Promise<Collection> {
  const now = new Date().toISOString();
  const collection: Collection = {
    ...data,
    id: crypto.randomUUID(),
    kind: "collection",
    createdAt: now,
    updatedAt: now,
  };
  const validated = CollectionSchema.parse(collection);
  await buffer.enqueue({
    table: "collections",
    op: "insert",
    payload: validated,
  });
  logger.info("db.postgres", "Created collection (enqueued)", {
    collectionId: collection.id,
    name: collection.name,
  });
  return validated;
}

export async function updateCollection(
  id: string,
  updates: Partial<Omit<Collection, "id" | "kind" | "createdAt">>
): Promise<void> {
  const updated = { id, ...updates, updatedAt: new Date().toISOString() };
  await buffer.enqueue({
    table: "collections",
    op: "update",
    payload: updated,
  });
  logger.info("db.postgres", "Updated collection (enqueued)", {
    collectionId: id,
    fields: Object.keys(updates),
  });
}

export async function deleteCollection(id: string): Promise<void> {
  await buffer.enqueue({ table: "collections", op: "delete", payload: { id } });
  logger.info("db.postgres", "Deleted collection (enqueued)", {
    collectionId: id,
  });
}
