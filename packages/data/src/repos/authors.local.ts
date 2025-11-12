/**
 * Local repository for Author entities (Optimistic Layer)
 * Instant writes to Dexie, queued for background sync
 */

import type { Author } from "@deeprecall/core";
import { AuthorSchema } from "@deeprecall/core";
import { db } from "../db";
import { createWriteBuffer } from "../writeBuffer";
import { logger } from "@deeprecall/telemetry";
import { isAuthenticated } from "../auth";

const buffer = createWriteBuffer();

/**
 * Create a new author (instant local write)
 * Writes to Dexie immediately, enqueues for server sync
 */
export async function createAuthorLocal(
  data: Omit<Author, "id" | "kind" | "createdAt" | "updatedAt">
): Promise<Author> {
  const now = new Date().toISOString();
  const author: Author = {
    ...data,
    id: crypto.randomUUID(),
    kind: "author",
    createdAt: now,
    updatedAt: now,
  };

  const validated = AuthorSchema.parse(author);

  // Write to local table (instant)
  await db.authors_local.add({
    id: validated.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: validated,
  });

  // Enqueue for server sync (background)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "authors",
      op: "insert",
      payload: validated,
    });
  }

  logger.info("db.local", "Created author (pending sync)", {
    authorId: author.id,
    willSync: isAuthenticated(),
  });
  return validated;
}

/**
 * Update an author (instant local write)
 */
export async function updateAuthorLocal(
  id: string,
  updates: Partial<Omit<Author, "id" | "kind" | "createdAt">>
): Promise<void> {
  const now = new Date().toISOString();
  const updated = { id, ...updates, updatedAt: now };

  // Write to local table (instant)
  await db.authors_local.add({
    id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: updated as any, // Partial update data
  });

  // Enqueue for server sync (background)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "authors",
      op: "update",
      payload: updated,
    });
  }

  logger.info("db.local", "Updated author (pending sync)", {
    authorId: id,
    willSync: isAuthenticated(),
  });
}

/**
 * Delete an author (instant local write)
 */
export async function deleteAuthorLocal(id: string): Promise<void> {
  // Write to local table (instant)
  await db.authors_local.add({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
    data: { id } as any, // Delete only needs ID
  });

  // Enqueue for server sync (background)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "authors",
      op: "delete",
      payload: { id },
    });
  }

  logger.info("db.local", "Deleted author (pending sync)", {
    authorId: id,
    willSync: isAuthenticated(),
  });
}
