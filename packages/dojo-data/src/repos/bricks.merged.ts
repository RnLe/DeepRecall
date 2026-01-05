/**
 * Bricks Merged Repository (Read Layer)
 *
 * Combines synced data (from Electric) + local changes (from Dexie)
 * Returns instant feedback with _local metadata for sync status.
 */

import type {
  ConceptBrickState,
  ExerciseBrickState,
} from "@deeprecall/dojo-core";
import { dojoDb, type LocalChange } from "../db";
import { conceptBrickToDomain, exerciseBrickToDomain } from "../mappers";
import type { DojoConceptBrickRow, DojoExerciseBrickRow } from "../types/rows";
import { logger } from "@deeprecall/telemetry";

export interface MergedConceptBrickState extends ConceptBrickState {
  _local?: {
    op: "insert" | "update" | "delete";
    status: "pending" | "syncing" | "synced" | "error";
    timestamp: number;
  };
}

export interface MergedExerciseBrickState extends ExerciseBrickState {
  _local?: {
    op: "insert" | "update" | "delete";
    status: "pending" | "syncing" | "synced" | "error";
    timestamp: number;
  };
}

// =============================================================================
// Concept Brick Merge Functions
// =============================================================================

/**
 * Merge synced concept bricks with local changes
 */
export async function mergeConceptBricks(
  synced: DojoConceptBrickRow[],
  local: LocalChange<DojoConceptBrickRow>[]
): Promise<MergedConceptBrickState[]> {
  const syncedMap = new Map(synced.map((row) => [row.id, row]));
  const result: MergedConceptBrickState[] = [];

  const pendingInserts = new Map<string, LocalChange<DojoConceptBrickRow>>();
  const pendingDeletes = new Set<string>();

  for (const localChange of local) {
    if (localChange._op === "insert") {
      pendingInserts.set(localChange.id, localChange);
    } else if (localChange._op === "delete") {
      pendingDeletes.add(localChange.id);
    }
  }

  const processedIds = new Set<string>();

  // Add bricks with pending inserts (upserts)
  for (const [id, insertChange] of pendingInserts) {
    if (pendingDeletes.has(id)) {
      processedIds.add(id);
      continue;
    }

    if (!insertChange.data) continue;

    result.push({
      ...conceptBrickToDomain(insertChange.data),
      _local: {
        op: "insert",
        status: insertChange._status,
        timestamp: insertChange._timestamp,
      },
    });
    processedIds.add(id);
    syncedMap.delete(id);
  }

  // Add remaining synced bricks
  for (const [id, row] of syncedMap) {
    if (pendingDeletes.has(id)) {
      continue;
    }
    result.push(conceptBrickToDomain(row));
  }

  return result;
}

/**
 * Get merged concept bricks from Dexie
 */
export async function getMergedConceptBricks(
  userId?: string
): Promise<MergedConceptBrickState[]> {
  let synced = await dojoDb.dojo_concept_bricks.toArray();
  if (userId) {
    synced = synced.filter((row) => row.owner_id === userId);
  }

  const local = await dojoDb.dojo_concept_bricks_local.toArray();

  return mergeConceptBricks(synced, local);
}

/**
 * Get a merged concept brick by concept ID
 */
export async function getMergedConceptBrick(
  conceptId: string,
  userId?: string
): Promise<MergedConceptBrickState | undefined> {
  let synced = await dojoDb.dojo_concept_bricks
    .where("concept_id")
    .equals(conceptId)
    .toArray();

  if (userId) {
    synced = synced.filter((row) => row.owner_id === userId);
  }

  const local = await dojoDb.dojo_concept_bricks_local.toArray();

  const merged = await mergeConceptBricks(synced, local);
  return merged.find((b) => b.conceptId === conceptId);
}

/**
 * Get merged concept bricks by IDs
 */
export async function getMergedConceptBricksByIds(
  conceptIds: string[],
  userId?: string
): Promise<MergedConceptBrickState[]> {
  const allBricks = await getMergedConceptBricks(userId);
  return allBricks.filter((b) => conceptIds.includes(b.conceptId));
}

// =============================================================================
// Exercise Brick Merge Functions
// =============================================================================

/**
 * Merge synced exercise bricks with local changes
 */
export async function mergeExerciseBricks(
  synced: DojoExerciseBrickRow[],
  local: LocalChange<DojoExerciseBrickRow>[]
): Promise<MergedExerciseBrickState[]> {
  const syncedMap = new Map(synced.map((row) => [row.id, row]));
  const result: MergedExerciseBrickState[] = [];

  const pendingInserts = new Map<string, LocalChange<DojoExerciseBrickRow>>();
  const pendingDeletes = new Set<string>();

  for (const localChange of local) {
    if (localChange._op === "insert") {
      pendingInserts.set(localChange.id, localChange);
    } else if (localChange._op === "delete") {
      pendingDeletes.add(localChange.id);
    }
  }

  const processedIds = new Set<string>();

  // Add bricks with pending inserts (upserts)
  for (const [id, insertChange] of pendingInserts) {
    if (pendingDeletes.has(id)) {
      processedIds.add(id);
      continue;
    }

    if (!insertChange.data) continue;

    result.push({
      ...exerciseBrickToDomain(insertChange.data),
      _local: {
        op: "insert",
        status: insertChange._status,
        timestamp: insertChange._timestamp,
      },
    });
    processedIds.add(id);
    syncedMap.delete(id);
  }

  // Add remaining synced bricks
  for (const [id, row] of syncedMap) {
    if (pendingDeletes.has(id)) {
      continue;
    }
    result.push(exerciseBrickToDomain(row));
  }

  return result;
}

/**
 * Get merged exercise bricks from Dexie
 */
export async function getMergedExerciseBricks(
  userId?: string
): Promise<MergedExerciseBrickState[]> {
  let synced = await dojoDb.dojo_exercise_bricks.toArray();
  if (userId) {
    synced = synced.filter((row) => row.owner_id === userId);
  }

  const local = await dojoDb.dojo_exercise_bricks_local.toArray();

  return mergeExerciseBricks(synced, local);
}

/**
 * Get a merged exercise brick by template ID
 */
export async function getMergedExerciseBrick(
  templateId: string,
  userId?: string
): Promise<MergedExerciseBrickState | undefined> {
  let synced = await dojoDb.dojo_exercise_bricks
    .where("template_id")
    .equals(templateId)
    .toArray();

  if (userId) {
    synced = synced.filter((row) => row.owner_id === userId);
  }

  const local = await dojoDb.dojo_exercise_bricks_local.toArray();

  const merged = await mergeExerciseBricks(synced, local);
  return merged.find((b) => b.templateId === templateId);
}

/**
 * Get merged exercise bricks by IDs
 */
export async function getMergedExerciseBricksByIds(
  templateIds: string[],
  userId?: string
): Promise<MergedExerciseBrickState[]> {
  const allBricks = await getMergedExerciseBricks(userId);
  return allBricks.filter((b) => templateIds.includes(b.templateId));
}
