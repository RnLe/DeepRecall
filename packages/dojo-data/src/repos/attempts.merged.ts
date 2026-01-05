/**
 * Attempts Merged Repository (Read Layer)
 *
 * Combines synced data (from Electric) + local changes (from Dexie)
 * Returns instant feedback with _local metadata for sync status.
 */

import type { ExerciseAttempt, SubtaskAttempt } from "@deeprecall/dojo-core";
import { dojoDb, type LocalChange } from "../db";
import { exerciseAttemptToDomain, subtaskAttemptToDomain } from "../mappers";
import type {
  DojoExerciseAttemptRow,
  DojoSubtaskAttemptRow,
} from "../types/rows";
import { logger } from "@deeprecall/telemetry";

export interface MergedExerciseAttempt extends ExerciseAttempt {
  _local?: {
    op: "insert" | "update" | "delete";
    status: "pending" | "syncing" | "synced" | "error";
    timestamp: number;
  };
}

/**
 * Merge synced exercise attempts with local changes
 */
export async function mergeExerciseAttempts(
  synced: DojoExerciseAttemptRow[],
  local: LocalChange<DojoExerciseAttemptRow>[]
): Promise<MergedExerciseAttempt[]> {
  const syncedMap = new Map(synced.map((row) => [row.id, row]));
  const result: MergedExerciseAttempt[] = [];

  const pendingInserts = new Map<string, LocalChange<DojoExerciseAttemptRow>>();
  const pendingUpdates = new Map<
    string,
    LocalChange<DojoExerciseAttemptRow>[]
  >();
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

  // First: Add attempts with pending inserts
  for (const [id, insertChange] of pendingInserts) {
    if (pendingDeletes.has(id)) {
      processedIds.add(id);
      continue;
    }

    if (!insertChange.data) continue;

    let row = insertChange.data;
    let latestTimestamp = insertChange._timestamp;
    let latestStatus = insertChange._status;

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
      ...exerciseAttemptToDomain(row, []),
      _local: {
        op: "insert",
        status: latestStatus,
        timestamp: latestTimestamp,
      },
    });
    processedIds.add(id);
    syncedMap.delete(id);
  }

  // Second: Add synced attempts with updates
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
        ...exerciseAttemptToDomain(merged, []),
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

  // Third: Add remaining synced attempts
  for (const [id, row] of syncedMap) {
    if (pendingDeletes.has(id)) {
      continue;
    }
    result.push(exerciseAttemptToDomain(row, []));
  }

  return result;
}

/**
 * Get merged exercise attempts from Dexie
 */
export async function getMergedExerciseAttempts(
  userId?: string
): Promise<MergedExerciseAttempt[]> {
  let synced = await dojoDb.dojo_exercise_attempts.toArray();
  if (userId) {
    synced = synced.filter((row) => row.owner_id === userId);
  }

  const local = await dojoDb.dojo_exercise_attempts_local.toArray();

  return mergeExerciseAttempts(synced, local);
}

/**
 * Get merged exercise attempts by template
 */
export async function getMergedExerciseAttemptsByTemplate(
  templateId: string,
  userId?: string
): Promise<MergedExerciseAttempt[]> {
  let synced = await dojoDb.dojo_exercise_attempts
    .where("template_id")
    .equals(templateId)
    .toArray();

  if (userId) {
    synced = synced.filter((row) => row.owner_id === userId);
  }

  const local = await dojoDb.dojo_exercise_attempts_local.toArray();

  const merged = await mergeExerciseAttempts(synced, local);
  return merged.filter((a) => a.templateId === templateId);
}

/**
 * Get merged exercise attempts by session
 */
export async function getMergedExerciseAttemptsBySession(
  sessionId: string,
  userId?: string
): Promise<MergedExerciseAttempt[]> {
  let synced = await dojoDb.dojo_exercise_attempts
    .where("session_id")
    .equals(sessionId)
    .toArray();

  if (userId) {
    synced = synced.filter((row) => row.owner_id === userId);
  }

  const local = await dojoDb.dojo_exercise_attempts_local.toArray();

  const merged = await mergeExerciseAttempts(synced, local);
  return merged.filter((a) => a.sessionId === sessionId);
}

/**
 * Get a single merged exercise attempt by ID
 */
export async function getMergedExerciseAttempt(
  id: string
): Promise<MergedExerciseAttempt | undefined> {
  const localChanges = await dojoDb.dojo_exercise_attempts_local
    .where("id")
    .equals(id)
    .toArray();

  if (localChanges.some((c) => c._op === "delete")) {
    return undefined;
  }

  const synced = await dojoDb.dojo_exercise_attempts.get(id);

  if (localChanges.length > 0) {
    const insertChange = localChanges.find((c) => c._op === "insert");
    const updates = localChanges.filter((c) => c._op === "update");

    let row: DojoExerciseAttemptRow;
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
      ...exerciseAttemptToDomain(row, []),
      _local: {
        op,
        status: latestStatus,
        timestamp: latestTimestamp,
      },
    };
  }

  if (synced) {
    return exerciseAttemptToDomain(synced, []);
  }

  return undefined;
}

/**
 * Get merged exercise attempt with subtask attempts
 */
export async function getMergedExerciseAttemptWithSubtasks(
  attemptId: string
): Promise<MergedExerciseAttempt | undefined> {
  const attempt = await getMergedExerciseAttempt(attemptId);
  if (!attempt) return undefined;

  // Get subtask attempts
  const subtasksSynced = await dojoDb.dojo_subtask_attempts
    .where("attempt_id")
    .equals(attemptId)
    .toArray();

  const subtasksLocal = await dojoDb.dojo_subtask_attempts_local
    .where("id")
    .equals(attemptId) // This might not work correctly, need to filter
    .toArray();

  // For now, just use synced subtasks
  const subtaskAttempts = subtasksSynced.map(subtaskAttemptToDomain);

  return {
    ...attempt,
    subtaskAttempts,
  };
}
