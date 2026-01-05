/**
 * Bricks Electric Repository
 *
 * Read-path: Electric shapes syncing from Postgres
 * Write-path: WriteBuffer queue → /api/writes/batch → Postgres → Electric
 *
 * Bricks are per-user mastery state for concepts and exercises.
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
import { useShape, createWriteBuffer } from "@deeprecall/data";
import { logger } from "@deeprecall/telemetry";
import type { DojoConceptBrickRow, DojoExerciseBrickRow } from "../types/rows";
import {
  conceptBrickToDomain,
  conceptBrickToRow,
  exerciseBrickToDomain,
  exerciseBrickToRow,
} from "../mappers";

// =============================================================================
// Electric Read Hooks - Concept Bricks
// =============================================================================

/**
 * React hook to get all concept bricks for a user
 * @param userId - Owner filter for multi-tenant isolation
 */
export function useConceptBricks(userId?: string) {
  const result = useShape<DojoConceptBrickRow>({
    table: "dojo_concept_bricks",
    where: userId ? `owner_id = '${userId}'` : undefined,
  });

  return {
    ...result,
    data: result.data?.map(conceptBrickToDomain),
  };
}

/**
 * React hook to get a concept brick for a specific concept
 */
export function useConceptBrick(
  conceptId: ConceptNodeId | undefined,
  userId?: string
) {
  const whereClause =
    conceptId && userId
      ? `owner_id = '${userId}' AND concept_id = '${conceptId}'`
      : conceptId
        ? `concept_id = '${conceptId}'`
        : undefined;

  const result = useShape<DojoConceptBrickRow>({
    table: "dojo_concept_bricks",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.[0] ? conceptBrickToDomain(result.data[0]) : undefined,
  };
}

/**
 * React hook to get concept bricks for specific concepts
 */
export function useConceptBricksByIds(
  conceptIds: ConceptNodeId[],
  userId?: string
) {
  // Build array literal for PostgreSQL
  const arrayLiteral = `'{${conceptIds.join(",")}}'`;
  const whereClause = userId
    ? `owner_id = '${userId}' AND concept_id = ANY(${arrayLiteral})`
    : `concept_id = ANY(${arrayLiteral})`;

  const result = useShape<DojoConceptBrickRow>({
    table: "dojo_concept_bricks",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.map(conceptBrickToDomain),
  };
}

// =============================================================================
// Electric Read Hooks - Exercise Bricks
// =============================================================================

/**
 * React hook to get all exercise bricks for a user
 * @param userId - Owner filter for multi-tenant isolation
 */
export function useExerciseBricks(userId?: string) {
  const result = useShape<DojoExerciseBrickRow>({
    table: "dojo_exercise_bricks",
    where: userId ? `owner_id = '${userId}'` : undefined,
  });

  return {
    ...result,
    data: result.data?.map(exerciseBrickToDomain),
  };
}

/**
 * React hook to get an exercise brick for a specific template
 */
export function useExerciseBrick(
  templateId: ExerciseTemplateId | undefined,
  userId?: string
) {
  const whereClause =
    templateId && userId
      ? `owner_id = '${userId}' AND template_id = '${templateId}'`
      : templateId
        ? `template_id = '${templateId}'`
        : undefined;

  const result = useShape<DojoExerciseBrickRow>({
    table: "dojo_exercise_bricks",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.[0] ? exerciseBrickToDomain(result.data[0]) : undefined,
  };
}

/**
 * React hook to get exercise bricks for specific templates
 */
export function useExerciseBricksByIds(
  templateIds: ExerciseTemplateId[],
  userId?: string
) {
  // Build array literal for PostgreSQL
  const arrayLiteral = `'{${templateIds.join(",")}}'`;
  const whereClause = userId
    ? `owner_id = '${userId}' AND template_id = ANY(${arrayLiteral})`
    : `template_id = ANY(${arrayLiteral})`;

  const result = useShape<DojoExerciseBrickRow>({
    table: "dojo_exercise_bricks",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.map(exerciseBrickToDomain),
  };
}

// =============================================================================
// Write Operations - Concept Bricks
// =============================================================================

const buffer = createWriteBuffer();

/**
 * Create or update a concept brick
 */
export async function upsertConceptBrick(
  conceptId: ConceptNodeId,
  metrics: BrickMastery,
  ownerId: string,
  existingId?: ConceptBrickStateId
): Promise<ConceptBrickState> {
  const now = new Date().toISOString();
  const id = existingId ?? asConceptBrickStateId(crypto.randomUUID());

  const brick: ConceptBrickState = {
    id,
    userId: ownerId as any, // Will be cast to UserId
    conceptId,
    metrics,
    createdAt: now,
    updatedAt: now,
  };

  const row = conceptBrickToRow(brick);

  if (existingId) {
    // Update existing brick
    await buffer.enqueue({
      table: "dojo_concept_bricks",
      op: "update",
      payload: {
        id: existingId,
        owner_id: ownerId,
        metrics: row.metrics,
        updated_at: now,
      },
    });
  } else {
    // Create new brick
    await buffer.enqueue({
      table: "dojo_concept_bricks",
      op: "insert",
      payload: row,
    });
  }

  logger.info("db.local", "Upserted concept brick (enqueued)", {
    brickId: id,
    conceptId,
    masteryScore: metrics.masteryScore,
  });

  return brick;
}

/**
 * Delete a concept brick
 */
export async function deleteConceptBrick(
  id: ConceptBrickStateId,
  ownerId: string
): Promise<void> {
  await buffer.enqueue({
    table: "dojo_concept_bricks",
    op: "delete",
    payload: { id, owner_id: ownerId },
  });

  logger.info("db.local", "Deleted concept brick (enqueued)", {
    brickId: id,
  });
}

// =============================================================================
// Write Operations - Exercise Bricks
// =============================================================================

/**
 * Create or update an exercise brick
 */
export async function upsertExerciseBrick(
  templateId: ExerciseTemplateId,
  metrics: BrickMastery,
  ownerId: string,
  existingId?: ExerciseBrickStateId,
  recentAttemptIds?: string[]
): Promise<ExerciseBrickState> {
  const now = new Date().toISOString();
  const id = existingId ?? asExerciseBrickStateId(crypto.randomUUID());

  const brick: ExerciseBrickState = {
    id,
    userId: ownerId as any, // Will be cast to UserId
    templateId,
    metrics,
    recentAttemptIds,
    createdAt: now,
    updatedAt: now,
  };

  const row = exerciseBrickToRow(brick);

  if (existingId) {
    // Update existing brick
    await buffer.enqueue({
      table: "dojo_exercise_bricks",
      op: "update",
      payload: {
        id: existingId,
        owner_id: ownerId,
        metrics: row.metrics,
        recent_attempt_ids: row.recent_attempt_ids,
        updated_at: now,
      },
    });
  } else {
    // Create new brick
    await buffer.enqueue({
      table: "dojo_exercise_bricks",
      op: "insert",
      payload: row,
    });
  }

  logger.info("db.local", "Upserted exercise brick (enqueued)", {
    brickId: id,
    templateId,
    masteryScore: metrics.masteryScore,
  });

  return brick;
}

/**
 * Delete an exercise brick
 */
export async function deleteExerciseBrick(
  id: ExerciseBrickStateId,
  ownerId: string
): Promise<void> {
  await buffer.enqueue({
    table: "dojo_exercise_bricks",
    op: "delete",
    payload: { id, owner_id: ownerId },
  });

  logger.info("db.local", "Deleted exercise brick (enqueued)", {
    brickId: id,
  });
}
