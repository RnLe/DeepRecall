/**
 * Repository for Collection entities (Electric + WriteBuffer version)
 */

import type { Collection } from "@deeprecall/core";
import { CollectionSchema } from "@deeprecall/core";
import { useShape } from "../electric";
import { createWriteBuffer } from "../writeBuffer";

export function useCollections() {
  return useShape<Collection>({ table: "collections" });
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
  console.log(
    `[CollectionsRepo] Created collection ${collection.id} (enqueued)`
  );
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
  console.log(`[CollectionsRepo] Updated collection ${id} (enqueued)`);
}

export async function deleteCollection(id: string): Promise<void> {
  await buffer.enqueue({ table: "collections", op: "delete", payload: { id } });
  console.log(`[CollectionsRepo] Deleted collection ${id} (enqueued)`);
}
