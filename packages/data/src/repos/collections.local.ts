/**
 * Local repository for Collection entities (Optimistic Layer)
 * Instant writes to Dexie, queued for background sync
 */

import type { Collection } from "@deeprecall/core";
import { CollectionSchema } from "@deeprecall/core";
import { db } from "../db";
import { createWriteBuffer } from "../writeBuffer";
import { logger } from "@deeprecall/telemetry";
import { isAuthenticated } from "../auth";

const buffer = createWriteBuffer();

/**
 * Create a new collection (instant local write)
 * Writes to Dexie immediately, enqueues for server sync
 */
export async function createCollectionLocal(
  data: Omit<Collection, "id" | "kind" | "createdAt" | "updatedAt">,
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
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "collections",
      op: "insert",
      payload: validated,
    });
  }

  logger.info("db.local", "Created collection (pending sync)", {
    collectionId: collection.id,
    name: collection.name,

    willSync: isAuthenticated(),
  });
  return validated;
}

/**
 * Update a collection (instant local write)
 */
export async function updateCollectionLocal(
  id: string,
  updates: Partial<Omit<Collection, "id" | "kind" | "createdAt">>,
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
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "collections",
      op: "update",
      payload: updated,
    });
  }

  logger.info("db.local", "Updated collection (pending sync)", {
    collectionId: id,
    fields: Object.keys(updates),

    willSync: isAuthenticated(),
  });
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
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "collections",
      op: "delete",
      payload: { id },
    });
  }

  logger.info("db.local", "Deleted collection (pending sync)", {
    collectionId: id,

    willSync: isAuthenticated(),
  });
}
