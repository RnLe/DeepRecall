/**
 * Bricks Local Repository (Optimistic Layer)
 *
 * Instant writes to Dexie, queued for background sync via WriteBuffer.
 * Handles ConceptBrickState and ExerciseBrickState (mastery tracking).
 */

import type {
  ConceptBrickState,
  ExerciseBrickState,
  BrickMastery,
  ConceptNodeId,
  ExerciseTemplateId,
  ConceptBrickStateId,
  ExerciseBrickStateId,
} from "@deeprecall/dojo-core";
import {
  asConceptBrickStateId,
  asExerciseBrickStateId,
} from "@deeprecall/dojo-core";
import { createWriteBuffer, isAuthenticated } from "@deeprecall/data";
import { logger } from "@deeprecall/telemetry";
import { dojoDb } from "../db";
import { conceptBrickToRow, exerciseBrickToRow } from "../mappers";

const buffer = createWriteBuffer();

// =============================================================================
// Concept Brick Local Operations
// =============================================================================

/**
 * Upsert (create or update) a concept brick (instant local write)
 */
export async function upsertConceptBrickLocal(
  conceptId: ConceptNodeId,
  metrics: BrickMastery,
  userId: string,
  ownerId: string
): Promise<ConceptBrickState> {
  const now = new Date().toISOString();
  const id = asConceptBrickStateId(`${userId}_${conceptId}`);

  const brick: ConceptBrickState = {
    id,
    userId: userId as any,
    conceptId,
    metrics,
    createdAt: now,
    updatedAt: now,
  };

  const row = conceptBrickToRow(brick);
  row.owner_id = ownerId;

  // Write to local table (instant)
  await dojoDb.dojo_concept_bricks_local.add({
    id: brick.id,
    _op: "insert", // Upsert is handled by the server
    _status: "pending",
    _timestamp: Date.now(),
    data: row,
  });

  // Enqueue for server sync (background, only if authenticated)
  // Server handles upsert via ON CONFLICT
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_concept_bricks",
      op: "insert",
      payload: row,
    });
  }

  logger.info("db.local", "Upserted concept brick (pending sync)", {
    brickId: id,
    conceptId,
    masteryScore: metrics.masteryScore,
    willSync: isAuthenticated(),
  });

  return brick;
}

/**
 * Delete a concept brick (instant local write)
 */
export async function deleteConceptBrickLocal(
  id: ConceptBrickStateId,
  ownerId: string
): Promise<void> {
  // Write to local table (instant)
  await dojoDb.dojo_concept_bricks_local.add({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_concept_bricks",
      op: "delete",
      payload: { id, owner_id: ownerId },
    });
  }

  logger.info("db.local", "Deleted concept brick (pending sync)", {
    brickId: id,
    willSync: isAuthenticated(),
  });
}

// =============================================================================
// Exercise Brick Local Operations
// =============================================================================

/**
 * Upsert (create or update) an exercise brick (instant local write)
 */
export async function upsertExerciseBrickLocal(
  templateId: ExerciseTemplateId,
  metrics: BrickMastery,
  recentAttemptIds: string[] | undefined,
  userId: string,
  ownerId: string
): Promise<ExerciseBrickState> {
  const now = new Date().toISOString();
  const id = asExerciseBrickStateId(`${userId}_${templateId}`);

  const brick: ExerciseBrickState = {
    id,
    userId: userId as any,
    templateId,
    metrics,
    recentAttemptIds,
    createdAt: now,
    updatedAt: now,
  };

  const row = exerciseBrickToRow(brick);
  row.owner_id = ownerId;

  // Write to local table (instant)
  await dojoDb.dojo_exercise_bricks_local.add({
    id: brick.id,
    _op: "insert", // Upsert is handled by the server
    _status: "pending",
    _timestamp: Date.now(),
    data: row,
  });

  // Enqueue for server sync (background, only if authenticated)
  // Server handles upsert via ON CONFLICT
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_exercise_bricks",
      op: "insert",
      payload: row,
    });
  }

  logger.info("db.local", "Upserted exercise brick (pending sync)", {
    brickId: id,
    templateId,
    masteryScore: metrics.masteryScore,
    willSync: isAuthenticated(),
  });

  return brick;
}

/**
 * Delete an exercise brick (instant local write)
 */
export async function deleteExerciseBrickLocal(
  id: ExerciseBrickStateId,
  ownerId: string
): Promise<void> {
  // Write to local table (instant)
  await dojoDb.dojo_exercise_bricks_local.add({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_exercise_bricks",
      op: "delete",
      payload: { id, owner_id: ownerId },
    });
  }

  logger.info("db.local", "Deleted exercise brick (pending sync)", {
    brickId: id,
    willSync: isAuthenticated(),
  });
}
