/**
 * Repository for Edge entities (Electric + WriteBuffer version)
 */

import type { Edge, Relation } from "@deeprecall/core";
import { EdgeSchema } from "@deeprecall/core";
import { useShape } from "../electric";
import { createWriteBuffer } from "../writeBuffer";
import { logger } from "@deeprecall/telemetry";

export function useEdges() {
  return useShape<Edge>({ table: "edges" });
}

export function useEdge(id: string | undefined) {
  const result = useShape<Edge>({
    table: "edges",
    where: id ? `id = '${id}'` : undefined,
  });
  return { ...result, data: result.data?.[0] };
}

export function useEdgesFrom(fromId: string) {
  return useShape<Edge>({
    table: "edges",
    where: `from_id = '${fromId}'`,
  });
}

export function useEdgesTo(toId: string) {
  return useShape<Edge>({
    table: "edges",
    where: `to_id = '${toId}'`,
  });
}

export function useEdgesByRelation(fromId: string, relation: Relation) {
  return useShape<Edge>({
    table: "edges",
    where: `from_id = '${fromId}' AND relation = '${relation}'`,
  });
}

const buffer = createWriteBuffer();

export async function createEdge(
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
  await buffer.enqueue({ table: "edges", op: "insert", payload: validated });
  logger.info("db.local", "Created edge (enqueued)", {
    edgeId: edge.id,
    relation,
  });
  return validated;
}

export async function updateEdge(
  id: string,
  updates: Partial<Omit<Edge, "id" | "createdAt">>
): Promise<void> {
  await buffer.enqueue({
    table: "edges",
    op: "update",
    payload: { id, ...updates },
  });
  logger.info("db.local", "Updated edge (enqueued)", { edgeId: id });
}

export async function deleteEdge(id: string): Promise<void> {
  await buffer.enqueue({ table: "edges", op: "delete", payload: { id } });
  logger.info("db.local", "Deleted edge (enqueued)", { edgeId: id });
}

export async function deleteEdgesBetween(
  fromId: string,
  toId: string
): Promise<void> {
  // This would need a batch delete or server-side logic
  // For now, we'll need to get edges first then delete individually
  logger.warn("db.local", "deleteEdgesBetween requires fetching edges first", {
    fromId,
    toId,
  });
}
