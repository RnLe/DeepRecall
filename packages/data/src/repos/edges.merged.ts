/**
 * Merged repository for Edge entities (Read Layer)
 * Combines synced data (Dexie edges) + local changes (edges_local)
 * Returns instant feedback with _local metadata for sync status
 */

import type { Edge, Relation } from "@deeprecall/core";
import { db } from "../db";

export interface MergedEdge extends Edge {
  _local?: {
    op: "insert" | "update" | "delete";
    status: "pending" | "synced" | "error";
    timestamp: number;
  };
}

/**
 * Merge synced edges with local changes
 * Rules:
 * - Local INSERT → Show immediately (pending)
 * - Local UPDATE → Override synced data
 * - Local DELETE → Filter from results
 */
export async function mergeEdges(
  synced: Edge[],
  local: any[]
): Promise<MergedEdge[]> {
  const syncedMap = new Map(synced.map((e) => [e.id, e]));
  const result: MergedEdge[] = [];

  // Process local changes
  for (const localChange of local) {
    if (localChange._op === "insert") {
      // New edge (not yet synced)
      result.push({
        ...localChange.data,
        _local: {
          op: "insert",
          status: localChange._status,
          timestamp: localChange._timestamp,
        },
      });
      syncedMap.delete(localChange.id); // Don't duplicate
    } else if (localChange._op === "update") {
      // Updated edge (override synced)
      const syncedEdge = syncedMap.get(localChange.id);
      if (syncedEdge) {
        result.push({
          ...syncedEdge,
          ...localChange.data,
          _local: {
            op: "update",
            status: localChange._status,
            timestamp: localChange._timestamp,
          },
        });
        syncedMap.delete(localChange.id); // Don't duplicate
      }
    } else if (localChange._op === "delete") {
      // Deleted edge (filter out)
      syncedMap.delete(localChange.id);
    }
  }

  // Add remaining synced edges (no local changes)
  for (const syncedEdge of syncedMap.values()) {
    result.push(syncedEdge);
  }

  return result;
}

/**
 * Get all merged edges (synced + local)
 */
export async function getAllMergedEdges(): Promise<MergedEdge[]> {
  const synced = await db.edges.toArray();
  const local = await db.edges_local.toArray();
  return mergeEdges(synced, local);
}

/**
 * Get a single merged edge by ID
 */
export async function getMergedEdge(
  id: string
): Promise<MergedEdge | undefined> {
  const synced = await db.edges.get(id);
  const local = await db.edges_local.where("id").equals(id).toArray();

  if (local.length === 0) {
    return synced; // No local changes
  }

  // Apply local changes
  const allEdges = synced ? [synced] : [];
  const merged = await mergeEdges(allEdges, local);
  return merged[0];
}

/**
 * Get merged edges from a specific entity
 */
export async function getMergedEdgesFrom(
  fromId: string
): Promise<MergedEdge[]> {
  const synced = await db.edges.where("fromId").equals(fromId).toArray();
  const local = await db.edges_local.toArray();
  const allMerged = await mergeEdges(synced, local);
  // Filter for fromId (local changes might have different fromId)
  return allMerged.filter((e) => e.fromId === fromId);
}

/**
 * Get merged edges to a specific entity
 */
export async function getMergedEdgesTo(toId: string): Promise<MergedEdge[]> {
  const synced = await db.edges.where("toId").equals(toId).toArray();
  const local = await db.edges_local.toArray();
  const allMerged = await mergeEdges(synced, local);
  // Filter for toId (local changes might have different toId)
  return allMerged.filter((e) => e.toId === toId);
}

/**
 * Get merged edges by relation type
 */
export async function getMergedEdgesByRelation(
  fromId: string,
  relation: Relation
): Promise<MergedEdge[]> {
  const allEdges = await getMergedEdgesFrom(fromId);
  return allEdges.filter((e) => e.relation === relation);
}
