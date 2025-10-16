/**
 * Repository for Edge entities (relations between entities)
 * Encapsulates all Dexie operations for Edges
 *
 * MENTAL MODEL: Edges connect entities with typed relations
 *
 * For Assets specifically:
 * - Assets can be linked to Versions via versionId field (parent-child)
 * - Assets can also be linked to Activities/Collections via "contains" edges
 * - When an Asset has no versionId AND no edges, it's "unlinked"
 * - Creating/deleting "contains" edges changes Asset linking state
 *
 * Edge structure:
 * - fromId: Source entity (e.g., Activity ID)
 * - toId: Target entity (e.g., Asset ID)
 * - relation: Type of connection (e.g., "contains")
 *
 * Common pattern for Assets in Activities:
 *   Edge { fromId: activityId, toId: assetId, relation: "contains" }
 */

import { db } from "@/src/db/dexie";
import type { Edge, Relation } from "@/src/schema/library";
import { EdgeSchema } from "@/src/schema/library";

/**
 * Create a new Edge
 */
export async function createEdge(
  fromId: string,
  toId: string,
  relation: Relation,
  options?: {
    order?: number;
    metadata?: string;
  }
): Promise<Edge> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const edge: Edge = {
    id,
    fromId,
    toId,
    relation,
    order: options?.order,
    metadata: options?.metadata,
    createdAt: now,
  };

  // Validate before inserting
  const validated = EdgeSchema.parse(edge);
  await db.edges.add(validated);
  return validated;
}

/**
 * Get an Edge by ID
 */
export async function getEdge(id: string): Promise<Edge | undefined> {
  return db.edges.get(id);
}

/**
 * Get all outgoing edges from an entity
 */
export async function getOutgoingEdges(fromId: string): Promise<Edge[]> {
  return db.edges.where("fromId").equals(fromId).toArray();
}

/**
 * Get all incoming edges to an entity
 */
export async function getIncomingEdges(toId: string): Promise<Edge[]> {
  return db.edges.where("toId").equals(toId).toArray();
}

/**
 * Get all edges for an entity (both incoming and outgoing)
 */
export async function getAllEdgesForEntity(entityId: string): Promise<Edge[]> {
  const outgoing = await getOutgoingEdges(entityId);
  const incoming = await getIncomingEdges(entityId);
  return [...outgoing, ...incoming];
}

/**
 * Get edges by relation type from an entity
 */
export async function getEdgesByRelation(
  fromId: string,
  relation: Relation
): Promise<Edge[]> {
  return db.edges
    .where("fromId")
    .equals(fromId)
    .and((edge) => edge.relation === relation)
    .toArray();
}

/**
 * Check if an edge exists between two entities
 */
export async function edgeExists(
  fromId: string,
  toId: string,
  relation?: Relation
): Promise<boolean> {
  let query = db.edges
    .where("fromId")
    .equals(fromId)
    .and((edge) => edge.toId === toId);

  if (relation) {
    query = query.and((edge) => edge.relation === relation);
  }

  const count = await query.count();
  return count > 0;
}

/**
 * Delete an Edge
 */
export async function deleteEdge(id: string): Promise<void> {
  await db.edges.delete(id);
}

/**
 * Delete all edges between two entities
 */
export async function deleteEdgesBetween(
  fromId: string,
  toId: string,
  relation?: Relation
): Promise<void> {
  let query = db.edges
    .where("fromId")
    .equals(fromId)
    .and((edge) => edge.toId === toId);

  if (relation) {
    query = query.and((edge) => edge.relation === relation);
  }

  await query.delete();
}

/**
 * Delete all edges involving an entity (both incoming and outgoing)
 */
export async function deleteAllEdgesForEntity(entityId: string): Promise<void> {
  await db.edges.where("fromId").equals(entityId).delete();
  await db.edges.where("toId").equals(entityId).delete();
}

/**
 * Update edge order
 */
export async function updateEdgeOrder(
  id: string,
  order: number
): Promise<Edge | undefined> {
  const edge = await db.edges.get(id);
  if (!edge) return undefined;

  const updated: Edge = {
    ...edge,
    order,
  };

  await db.edges.update(id, updated);
  return updated;
}

/**
 * Update edge metadata
 */
export async function updateEdgeMetadata(
  id: string,
  metadata: string
): Promise<Edge | undefined> {
  const edge = await db.edges.get(id);
  if (!edge) return undefined;

  const updated: Edge = {
    ...edge,
    metadata,
  };

  await db.edges.update(id, updated);
  return updated;
}

/**
 * Reorder edges (for ordered collections)
 */
export async function reorderEdges(edgeIds: string[]): Promise<void> {
  await db.transaction("rw", db.edges, async () => {
    for (let i = 0; i < edgeIds.length; i++) {
      const edge = await db.edges.get(edgeIds[i]);
      if (edge) {
        await db.edges.update(edgeIds[i], { ...edge, order: i });
      }
    }
  });
}

// ============================================================================
// Convenience methods for common edge patterns
// ============================================================================

/**
 * Add entity to a collection
 */
export async function addToCollection(
  collectionId: string,
  entityId: string,
  order?: number
): Promise<Edge> {
  return createEdge(collectionId, entityId, "contains", { order });
}

/**
 * Remove entity from a collection
 */
export async function removeFromCollection(
  collectionId: string,
  entityId: string
): Promise<void> {
  await deleteEdgesBetween(collectionId, entityId, "contains");
}

/**
 * Add entity to an activity
 */
export async function addToActivity(
  activityId: string,
  entityId: string,
  order?: number
): Promise<Edge> {
  return createEdge(activityId, entityId, "contains", { order });
}

/**
 * Remove entity from an activity
 */
export async function removeFromActivity(
  activityId: string,
  entityId: string
): Promise<void> {
  await deleteEdgesBetween(activityId, entityId, "contains");
}

/**
 * Mark work/version as assigned in an activity
 */
export async function assignToActivity(
  activityId: string,
  entityId: string
): Promise<Edge> {
  return createEdge(entityId, activityId, "assignedIn");
}

/**
 * Create a citation edge between works/versions
 */
export async function createCitation(
  fromId: string,
  toId: string
): Promise<Edge> {
  return createEdge(fromId, toId, "cites");
}

/**
 * Create a prerequisite edge between works
 */
export async function createPrerequisite(
  fromId: string,
  toId: string
): Promise<Edge> {
  return createEdge(fromId, toId, "prerequisite");
}

/**
 * Get all entities contained in a collection (ordered if applicable)
 */
export async function getCollectionEntities(
  collectionId: string
): Promise<string[]> {
  const edges = await getEdgesByRelation(collectionId, "contains");

  // Sort by order if present
  edges.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return edges.map((edge) => edge.toId);
}

/**
 * Get all entities contained in an activity (ordered if applicable)
 */
export async function getActivityEntities(
  activityId: string
): Promise<string[]> {
  const edges = await getEdgesByRelation(activityId, "contains");

  // Sort by order if present
  edges.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return edges.map((edge) => edge.toId);
}

/**
 * Get all collections containing an entity
 */
export async function getCollectionsForEntity(
  entityId: string
): Promise<string[]> {
  const edges = await db.edges
    .where("toId")
    .equals(entityId)
    .and((edge) => edge.relation === "contains")
    .toArray();

  return edges.map((edge) => edge.fromId);
}
