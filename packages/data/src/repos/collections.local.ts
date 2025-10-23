/**
 * Local repository for Collection entities (Optimistic Layer)
 * Instant writes to Dexie, queued for background sync
 */

import type { Collection } from "@deeprecall/core";
import { CollectionSchema } from "@deeprecall/core";
import { db } from "../db";
import { createWriteBuffer } from "../writeBuffer";

const buffer = createWriteBuffer();

/**
 * Create a new collection (instant local write)
 * Writes to Dexie immediately, enqueues for server sync
 */
export async function createCollectionLocal(
  data: Omit<Collection, "id" | "kind" | "createdAt" | "updatedAt">
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

  // Write to local table (instant)
  await db.collections_local.add({
    id: validated.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: validated,
  });

  // Enqueue for server sync (background)
  await buffer.enqueue({
    table: "collections",
    op: "insert",
    payload: validated,
  });

  console.log(
    `[CollectionsLocal] Created collection ${collection.id} (pending sync)`
  );
  return validated;
}

/**
 * Update a collection (instant local write)
 */
export async function updateCollectionLocal(
  id: string,
  updates: Partial<Omit<Collection, "id" | "kind" | "createdAt">>
): Promise<void> {
  const now = new Date().toISOString();
  const updated = { id, ...updates, updatedAt: now };

  // Write to local table (instant)
  await db.collections_local.add({
    id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: updated as any, // Partial update data
  });

  // Enqueue for server sync (background)
  await buffer.enqueue({
    table: "collections",
    op: "update",
    payload: updated,
  });

  console.log(`[CollectionsLocal] Updated collection ${id} (pending sync)`);
}

/**
 * Delete a collection (instant local write)
 */
export async function deleteCollectionLocal(id: string): Promise<void> {
  // Write to local table (instant)
  await db.collections_local.add({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
    data: { id } as any, // Delete only needs ID
  });

  // Enqueue for server sync (background)
  await buffer.enqueue({
    table: "collections",
    op: "delete",
    payload: { id },
  });

  console.log(`[CollectionsLocal] Deleted collection ${id} (pending sync)`);
}
