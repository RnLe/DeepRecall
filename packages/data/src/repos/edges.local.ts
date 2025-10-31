/**
 * Local repository for Edge entities (Optimistic Layer)
 * Instant writes to Dexie, queued for background sync
 */

import type { Edge, Relation } from "@deeprecall/core";
import { EdgeSchema } from "@deeprecall/core";
import { db } from "../db";
import { createWriteBuffer } from "../writeBuffer";
import { logger } from "@deeprecall/telemetry";

const buffer = createWriteBuffer();

/**
 * Create a new edge (instant local write)
 * Writes to Dexie immediately, enqueues for server sync
 */
export async function createEdgeLocal(
  fromId: string,
  toId: string,
  relation: Relation,
  options?: { order?: number; metadata?: string }
): Promise<Edge> {
  const edge: Edge = {
    id: crypto.randomUUID(),
    fromId,
    toId,
    relation,
    order: options?.order,
    metadata: options?.metadata,
    createdAt: new Date().toISOString(),
  };

  const validated = EdgeSchema.parse(edge);

  // Write to local table (instant)
  await db.edges_local.add({
    id: validated.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: validated,
  });

  // Enqueue for server sync (background)
  await buffer.enqueue({
    table: "edges",
    op: "insert",
    payload: validated,
  });

  logger.info("db.local", "Created edge (pending sync)", {
    edgeId: edge.id,
    relation,
  });
  return validated;
}

/**
 * Update an edge (instant local write)
 */
export async function updateEdgeLocal(
  id: string,
  updates: Partial<Omit<Edge, "id" | "createdAt">>
): Promise<void> {
  const updated = { id, ...updates };

  // Write to local table (instant)
  await db.edges_local.add({
    id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: updated as any, // Partial update data
  });

  // Enqueue for server sync (background)
  await buffer.enqueue({
    table: "edges",
    op: "update",
    payload: updated,
  });

  logger.info("db.local", "Updated edge (pending sync)", { edgeId: id });
}

/**
 * Delete an edge (instant local write)
 */
export async function deleteEdgeLocal(id: string): Promise<void> {
  // Write to local table (instant)
  await db.edges_local.add({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
    data: { id } as any, // Delete only needs ID
  });

  // Enqueue for server sync (background)
  await buffer.enqueue({
    table: "edges",
    op: "delete",
    payload: { id },
  });

  logger.info("db.local", "Deleted edge (pending sync)", { edgeId: id });
}
