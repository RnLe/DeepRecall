/**
 * Sessions Merged Repository (Read Layer)
 *
 * Combines synced data (from Electric) + local changes (from Dexie)
 * Returns instant feedback with _local metadata for sync status.
 */

import type { Session } from "@deeprecall/dojo-core";
import { asAttemptId } from "@deeprecall/dojo-core";
import { dojoDb, type LocalChange } from "../db";
import { sessionToDomain } from "../mappers";
import type { DojoSessionRow } from "../types/rows";
import { logger } from "@deeprecall/telemetry";

export interface MergedSession extends Session {
  _local?: {
    op: "insert" | "update" | "delete";
    status: "pending" | "syncing" | "synced" | "error";
    timestamp: number;
  };
}

/**
 * Merge synced sessions with local changes
 */
export async function mergeSessions(
  synced: DojoSessionRow[],
  local: LocalChange<DojoSessionRow>[]
): Promise<MergedSession[]> {
  const syncedMap = new Map(synced.map((row) => [row.id, row]));
  const result: MergedSession[] = [];

  const pendingInserts = new Map<string, LocalChange<DojoSessionRow>>();
  const pendingUpdates = new Map<string, LocalChange<DojoSessionRow>[]>();
  const pendingDeletes = new Set<string>();

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

  // First: Add sessions with pending inserts
  for (const [id, insertChange] of pendingInserts) {
    if (pendingDeletes.has(id)) {
      processedIds.add(id);
      continue;
    }

    if (!insertChange.data) continue;

    let row = insertChange.data;
    let latestTimestamp = insertChange._timestamp;
    let latestStatus = insertChange._status;

    // Track additional attempt IDs from updates
    const additionalAttemptIds: string[] = [];

    const updates = pendingUpdates.get(id);
    if (updates) {
      for (const update of updates) {
        if (update.data) {
          // Handle special _addAttemptId field
          const updateData = update.data as any;
          if (updateData._addAttemptId) {
            additionalAttemptIds.push(updateData._addAttemptId);
          }
          row = { ...row, ...update.data };
        }
        latestTimestamp = Math.max(latestTimestamp, update._timestamp);
        latestStatus = update._status;
      }
    }

    const session = sessionToDomain(row);

    // Merge additional attempt IDs
    if (additionalAttemptIds.length > 0) {
      session.attemptIds = [
        ...session.attemptIds,
        ...additionalAttemptIds.map(asAttemptId),
      ];
    }

    result.push({
      ...session,
      _local: {
        op: "insert",
        status: latestStatus,
        timestamp: latestTimestamp,
      },
    });
    processedIds.add(id);
    syncedMap.delete(id);
  }

  // Second: Add synced sessions with updates
  for (const [id, updates] of pendingUpdates) {
    if (processedIds.has(id) || pendingDeletes.has(id)) {
      continue;
    }

    const syncedRow = syncedMap.get(id);
    if (syncedRow) {
      let merged = { ...syncedRow };
      let latestTimestamp = 0;
      let latestStatus: "pending" | "syncing" | "synced" | "error" = "pending";
      const additionalAttemptIds: string[] = [];

      for (const update of updates) {
        if (update.data) {
          const updateData = update.data as any;
          if (updateData._addAttemptId) {
            additionalAttemptIds.push(updateData._addAttemptId);
          }
          merged = { ...merged, ...update.data };
        }
        latestTimestamp = Math.max(latestTimestamp, update._timestamp);
        latestStatus = update._status;
      }

      const session = sessionToDomain(merged);

      if (additionalAttemptIds.length > 0) {
        session.attemptIds = [
          ...session.attemptIds,
          ...additionalAttemptIds.map(asAttemptId),
        ];
      }

      result.push({
        ...session,
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

  // Third: Add remaining synced sessions
  for (const [id, row] of syncedMap) {
    if (pendingDeletes.has(id)) {
      continue;
    }
    result.push(sessionToDomain(row));
  }

  return result;
}

/**
 * Get merged sessions from Dexie
 */
export async function getMergedSessions(
  userId?: string
): Promise<MergedSession[]> {
  let synced = await dojoDb.dojo_sessions.toArray();
  if (userId) {
    synced = synced.filter((row) => row.owner_id === userId);
  }

  const local = await dojoDb.dojo_sessions_local.toArray();

  return mergeSessions(synced, local);
}

/**
 * Get merged active sessions
 */
export async function getMergedActiveSessions(
  userId?: string
): Promise<MergedSession[]> {
  const allSessions = await getMergedSessions(userId);
  return allSessions.filter((s) => s.status === "active");
}

/**
 * Get merged completed sessions
 */
export async function getMergedCompletedSessions(
  userId?: string
): Promise<MergedSession[]> {
  const allSessions = await getMergedSessions(userId);
  return allSessions.filter((s) => s.status === "completed");
}

/**
 * Get merged sessions by mode
 */
export async function getMergedSessionsByMode(
  mode: "normal" | "cram" | "exam-sim",
  userId?: string
): Promise<MergedSession[]> {
  const allSessions = await getMergedSessions(userId);
  return allSessions.filter((s) => s.mode === mode);
}

/**
 * Get a single merged session by ID
 */
export async function getMergedSession(
  id: string
): Promise<MergedSession | undefined> {
  const localChanges = await dojoDb.dojo_sessions_local
    .where("id")
    .equals(id)
    .toArray();

  if (localChanges.some((c) => c._op === "delete")) {
    return undefined;
  }

  const synced = await dojoDb.dojo_sessions.get(id);

  if (localChanges.length > 0) {
    const insertChange = localChanges.find((c) => c._op === "insert");
    const updates = localChanges.filter((c) => c._op === "update");

    let row: DojoSessionRow;
    let latestTimestamp = 0;
    let latestStatus: "pending" | "syncing" | "synced" | "error" = "pending";
    let op: "insert" | "update" = "update";
    const additionalAttemptIds: string[] = [];

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
        const updateData = update.data as any;
        if (updateData._addAttemptId) {
          additionalAttemptIds.push(updateData._addAttemptId);
        }
        row = { ...row, ...update.data };
      }
      latestTimestamp = Math.max(latestTimestamp, update._timestamp);
      latestStatus = update._status;
    }

    const session = sessionToDomain(row);

    if (additionalAttemptIds.length > 0) {
      session.attemptIds = [
        ...session.attemptIds,
        ...additionalAttemptIds.map(asAttemptId),
      ];
    }

    return {
      ...session,
      _local: {
        op,
        status: latestStatus,
        timestamp: latestTimestamp,
      },
    };
  }

  if (synced) {
    return sessionToDomain(synced);
  }

  return undefined;
}
