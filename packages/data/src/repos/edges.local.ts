/**
 * Local repository for Edge entities (Optimistic Layer)
 * Instant writes to Dexie, queued for background sync
 */

import type { Edge, Relation } from "@deeprecall/core";
import { EdgeSchema } from "@deeprecall/core";
import { db } from "../db";
import { createWriteBuffer } from "../writeBuffer";

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

  console.log(`[EdgesLocal] Created edge ${edge.id} (pending sync)`);
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

  console.log(`[EdgesLocal] Updated edge ${id} (pending sync)`);
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

  console.log(`[EdgesLocal] Deleted edge ${id} (pending sync)`);
}
