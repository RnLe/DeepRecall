/**
 * Merged repository for Edge entities (Read Layer)
 * Combines synced data (Dexie edges) + local changes (edges_local)
 * Returns instant feedback with _local metadata for sync status
 */

import type { Edge, Relation } from "@deeprecall/core";
import { db } from "../db";
import { logger } from "@deeprecall/telemetry";

export interface MergedEdge extends Edge {
  _local?: {
    op: "insert" | "update" | "delete";
    status: "pending" | "synced" | "error";
    timestamp: number;
  };
}

/**
 * Merge synced edges with local changes
 *
 * CRITICAL: Collects ALL updates per ID and applies sequentially (Pattern 2)
 * Fixes bug where only last update was applied before sync
 *
 * Rules:
 * - Local INSERT → Show immediately (pending)
 * - Local UPDATE → Apply ALL updates sequentially
 * - Local DELETE → Filter from results
 */
export async function mergeEdges(
  synced: Edge[],
  local: any[]
): Promise<MergedEdge[]> {
  // Phase 1: Collect changes by type and ID
  const pendingInserts = new Map<string, any>();
  const pendingUpdates = new Map<string, any[]>(); // Array to collect ALL updates
  const pendingDeletes = new Set<string>();

  for (const change of local) {
    if (change._op === "insert") {
      const existing = pendingInserts.get(change.id);
      if (!existing || change._timestamp > existing._timestamp) {
        pendingInserts.set(change.id, change);
      }
    } else if (change._op === "update") {
      // Collect ALL updates per ID (not just latest)
      if (!pendingUpdates.has(change.id)) {
        pendingUpdates.set(change.id, []);
      }
      pendingUpdates.get(change.id)!.push(change);
    } else if (change._op === "delete") {
      pendingDeletes.add(change.id);
    }
  }

  // Sort updates by timestamp for each ID
  for (const updates of pendingUpdates.values()) {
    updates.sort((a, b) => a._timestamp - b._timestamp);
  }

  const result: MergedEdge[] = [];
  const processedIds = new Set<string>();
  const syncedMap = new Map(synced.map((e) => [e.id, e]));

  // Phase 2: Process pending inserts (may have updates on top)
  for (const [id, insert] of pendingInserts) {
    if (pendingDeletes.has(id)) continue; // Deleted before sync

    processedIds.add(id);
    let mergedEdge: MergedEdge = {
      ...(insert.data as Edge),
      _local: {
        op: "insert",
        status: insert._status,
        timestamp: insert._timestamp,
      },
    };

    // Apply any updates that came after insert
    const updates = pendingUpdates.get(id);
    if (updates) {
      for (const update of updates) {
        mergedEdge = {
          ...mergedEdge,
          ...update.data,
          _local: {
            op: "update",
            status: update._status,
            timestamp: update._timestamp,
          },
        };
      }
    }

    result.push(mergedEdge);
  }

  // Phase 3: Process synced items with updates
  for (const [id, updates] of pendingUpdates) {
    if (processedIds.has(id)) continue; // Already processed as insert
    if (pendingDeletes.has(id)) continue; // Deleted

    const syncedItem = syncedMap.get(id);
    if (syncedItem) {
      processedIds.add(id);
      let mergedEdge: MergedEdge = { ...syncedItem };

      // Apply ALL updates sequentially
      for (const update of updates) {
        mergedEdge = {
          ...mergedEdge,
          ...update.data,
          _local: {
            op: "update",
            status: update._status,
            timestamp: update._timestamp,
          },
        };
      }

      result.push(mergedEdge);
    }
  }

  // Phase 4: Add synced items without local changes
  for (const syncedItem of synced) {
    if (processedIds.has(syncedItem.id)) continue; // Already processed
    if (pendingDeletes.has(syncedItem.id)) continue; // Deleted locally

    result.push(syncedItem);
  }

  return result;
}

/**
 * Get all merged edges (synced + local)
 */
export async function getAllMergedEdges(): Promise<MergedEdge[]> {
  try {
    const synced = await db.edges.toArray();
    const local = await db.edges_local.toArray();
    return mergeEdges(synced, local);
  } catch (error) {
    logger.error("db.local", "Failed to get all merged edges", {
      error: String(error),
    });
    return []; // Always return array, never undefined
  }
}

/**
 * Get a single merged edge by ID
 */
export async function getMergedEdge(
  id: string
): Promise<MergedEdge | undefined> {
  try {
    const synced = await db.edges.get(id);
    const local = await db.edges_local.where("id").equals(id).toArray();

    if (local.length === 0) {
      return synced; // No local changes
    }

    // Apply local changes
    const allEdges = synced ? [synced] : [];
    const merged = await mergeEdges(allEdges, local);
    return merged[0];
  } catch (error) {
    logger.error("db.local", "Failed to get merged edge", {
      edgeId: id,
      error: String(error),
    });
    return undefined;
  }
}

/**
 * Get merged edges from a specific entity
 */
export async function getMergedEdgesFrom(
  fromId: string
): Promise<MergedEdge[]> {
  try {
    const synced = await db.edges.where("fromId").equals(fromId).toArray();
    const local = await db.edges_local.toArray();
    const allMerged = await mergeEdges(synced, local);
    // Filter for fromId (local changes might have different fromId)
    return allMerged.filter((e) => e.fromId === fromId);
  } catch (error) {
    logger.error("db.local", "Failed to get merged edges from", {
      fromId,
      error: String(error),
    });
    return []; // Always return array, never undefined
  }
}

/**
 * Get merged edges to a specific entity
 */
export async function getMergedEdgesTo(toId: string): Promise<MergedEdge[]> {
  try {
    const synced = await db.edges.where("toId").equals(toId).toArray();
    const local = await db.edges_local.toArray();
    const allMerged = await mergeEdges(synced, local);
    // Filter for toId (local changes might have different toId)
    return allMerged.filter((e) => e.toId === toId);
  } catch (error) {
    logger.error("db.local", "Failed to get merged edges to", {
      toId,
      error: String(error),
    });
    return []; // Always return array, never undefined
  }
}

/**
 * Get merged edges by relation type
 */
export async function getMergedEdgesByRelation(
  fromId: string,
  relation: Relation
): Promise<MergedEdge[]> {
  try {
    const allEdges = await getMergedEdgesFrom(fromId);
    return allEdges.filter((e) => e.relation === relation);
  } catch (error) {
    logger.error("db.local", "Failed to get merged edges by relation", {
      fromId,
      relation,
      error: String(error),
    });
    return []; // Always return array, never undefined
  }
}
