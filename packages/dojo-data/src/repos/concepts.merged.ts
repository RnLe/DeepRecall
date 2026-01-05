/**
 * Concepts Merged Repository (Read Layer)
 *
 * Combines synced data (from Electric) + local changes (from Dexie)
 * Returns instant feedback with _local metadata for sync status.
 */

import type { ConceptNode } from "@deeprecall/dojo-core";
import { dojoDb, type LocalChange } from "../db";
import { conceptNodeToDomain } from "../mappers";
import type { DojoConceptNodeRow } from "../types/rows";
import { logger } from "@deeprecall/telemetry";

export interface MergedConceptNode extends ConceptNode {
  _local?: {
    op: "insert" | "update" | "delete";
    status: "pending" | "syncing" | "synced" | "error";
    timestamp: number;
  };
}

/**
 * Merge synced concept nodes with local changes
 * Rules:
 * - Local INSERT → Show immediately (pending)
 * - Local UPDATE → Override synced data
 * - Local DELETE → Filter from results
 * - Multiple UPDATEs to same concept → Merge all updates
 */
export async function mergeConceptNodes(
  synced: DojoConceptNodeRow[],
  local: LocalChange<DojoConceptNodeRow>[]
): Promise<MergedConceptNode[]> {
  const syncedMap = new Map(synced.map((row) => [row.id, row]));
  const result: MergedConceptNode[] = [];

  // Track pending operations
  const pendingInserts = new Map<string, LocalChange<DojoConceptNodeRow>>();
  const pendingUpdates = new Map<string, LocalChange<DojoConceptNodeRow>[]>();
  const pendingDeletes = new Set<string>();

  // Collect all local changes by type
  for (const localChange of local) {
    if (localChange._op === "insert") {
      pendingInserts.set(localChange.id, localChange);
    } else if (localChange._op === "update") {
      if (!pendingUpdates.has(localChange.id)) {
        pendingUpdates.set(localChange.id, []);
      }
      pendingUpdates.get(localChange.id)!.push(localChange);
    } else if (localChange._op === "delete") {
      pendingDeletes.add(localChange.id);
    }
  }

  const processedIds = new Set<string>();

  // First: Add concepts with pending inserts (may have updates too)
  for (const [id, insertChange] of pendingInserts) {
    if (pendingDeletes.has(id)) {
      // Deleted before syncing, skip
      processedIds.add(id);
      continue;
    }

    if (!insertChange.data) continue;

    let row = insertChange.data;
    let latestTimestamp = insertChange._timestamp;
    let latestStatus = insertChange._status;

    // Apply any pending updates to this insert
    const updates = pendingUpdates.get(id);
    if (updates) {
      for (const update of updates) {
        if (update.data) {
          row = { ...row, ...update.data };
        }
        latestTimestamp = Math.max(latestTimestamp, update._timestamp);
        latestStatus = update._status;
      }
    }

    result.push({
      ...conceptNodeToDomain(row),
      _local: {
        op: "insert",
        status: latestStatus,
        timestamp: latestTimestamp,
      },
    });
    processedIds.add(id);
    syncedMap.delete(id);
  }

  // Second: Add synced concepts with updates (no pending insert)
  for (const [id, updates] of pendingUpdates) {
    if (processedIds.has(id) || pendingDeletes.has(id)) {
      continue;
    }

    const syncedRow = syncedMap.get(id);
    if (syncedRow) {
      let merged = { ...syncedRow };
      let latestTimestamp = 0;
      let latestStatus: "pending" | "syncing" | "synced" | "error" = "pending";

      for (const update of updates) {
        if (update.data) {
          merged = { ...merged, ...update.data };
        }
        latestTimestamp = Math.max(latestTimestamp, update._timestamp);
        latestStatus = update._status;
      }

      result.push({
        ...conceptNodeToDomain(merged),
        _local: {
          op: "update",
          status: latestStatus,
          timestamp: latestTimestamp,
        },
      });
      processedIds.add(id);
      syncedMap.delete(id);
    }
  }

  // Third: Add remaining synced concepts (no local changes)
  for (const [id, row] of syncedMap) {
    if (pendingDeletes.has(id)) {
      continue; // Skip deleted items
    }
    result.push(conceptNodeToDomain(row));
  }

  return result;
}

/**
 * Get merged concept nodes from Dexie
 * Combines synced table with local changes
 */
export async function getMergedConceptNodes(
  userId?: string
): Promise<MergedConceptNode[]> {
  // Get synced data from Dexie
  let synced = await dojoDb.dojo_concept_nodes.toArray();
  if (userId) {
    synced = synced.filter((row) => row.owner_id === userId);
  }

  // Get local changes
  const local = await dojoDb.dojo_concept_nodes_local.toArray();

  return mergeConceptNodes(synced, local);
}

/**
 * Get merged concept nodes by domain
 */
export async function getMergedConceptNodesByDomain(
  domainId: string,
  userId?: string
): Promise<MergedConceptNode[]> {
  // Get synced data from Dexie
  let synced = await dojoDb.dojo_concept_nodes
    .where("domain_id")
    .equals(domainId)
    .toArray();

  if (userId) {
    synced = synced.filter((row) => row.owner_id === userId);
  }

  // Get local changes
  const local = await dojoDb.dojo_concept_nodes_local.toArray();

  // Merge and filter by domain
  const merged = await mergeConceptNodes(synced, local);
  return merged.filter((c) => c.domainId === domainId);
}

/**
 * Get a single merged concept node by ID
 */
export async function getMergedConceptNode(
  id: string
): Promise<MergedConceptNode | undefined> {
  // Check local first
  const localChanges = await dojoDb.dojo_concept_nodes_local
    .where("id")
    .equals(id)
    .toArray();

  // Check for delete
  if (localChanges.some((c) => c._op === "delete")) {
    return undefined;
  }

  // Get synced data
  const synced = await dojoDb.dojo_concept_nodes.get(id);

  // Apply local changes
  if (localChanges.length > 0) {
    const insertChange = localChanges.find((c) => c._op === "insert");
    const updates = localChanges.filter((c) => c._op === "update");

    let row: DojoConceptNodeRow;
    let latestTimestamp = 0;
    let latestStatus: "pending" | "syncing" | "synced" | "error" = "pending";
    let op: "insert" | "update" = "update";

    if (insertChange?.data) {
      row = insertChange.data;
      latestTimestamp = insertChange._timestamp;
      latestStatus = insertChange._status;
      op = "insert";
    } else if (synced) {
      row = synced;
    } else {
      return undefined;
    }

    for (const update of updates) {
      if (update.data) {
        row = { ...row, ...update.data };
      }
      latestTimestamp = Math.max(latestTimestamp, update._timestamp);
      latestStatus = update._status;
    }

    return {
      ...conceptNodeToDomain(row),
      _local: {
        op,
        status: latestStatus,
        timestamp: latestTimestamp,
      },
    };
  }

  // No local changes
  if (synced) {
    return conceptNodeToDomain(synced);
  }

  return undefined;
}
