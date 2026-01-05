/**
 * Attempts Electric Repository
 *
 * Read-path: Electric shapes syncing from Postgres
 * Write-path: WriteBuffer queue → /api/writes/batch → Postgres → Electric
 */

import type {
  ExerciseAttempt,
  ExerciseAttemptCreate,
  AttemptId,
  ExerciseTemplateId,
  SessionId,
  SubtaskAttempt,
} from "@deeprecall/dojo-core";
import { asAttemptId } from "@deeprecall/dojo-core";
import { useShape, createWriteBuffer } from "@deeprecall/data";
import { logger } from "@deeprecall/telemetry";
import type {
  DojoExerciseAttemptRow,
  DojoSubtaskAttemptRow,
} from "../types/rows";
import {
  exerciseAttemptToDomain,
  exerciseAttemptToRow,
  subtaskAttemptToDomain,
  subtaskAttemptToRow,
} from "../mappers";

// =============================================================================
// Electric Read Hooks - Attempts
// =============================================================================

/**
 * React hook to get all exercise attempts for a user
 * @param userId - Owner filter for multi-tenant isolation
 */
export function useExerciseAttempts(userId?: string) {
  const result = useShape<DojoExerciseAttemptRow>({
    table: "dojo_exercise_attempts",
    where: userId ? `owner_id = '${userId}'` : undefined,
  });

  return {
    ...result,
    data: result.data?.map((row) => exerciseAttemptToDomain(row, [])),
  };
}

/**
 * React hook to get attempts for a specific template
 */
export function useExerciseAttemptsByTemplate(
  templateId: ExerciseTemplateId,
  userId?: string
) {
  const whereClause = userId
    ? `owner_id = '${userId}' AND template_id = '${templateId}'`
    : `template_id = '${templateId}'`;

  const result = useShape<DojoExerciseAttemptRow>({
    table: "dojo_exercise_attempts",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.map((row) => exerciseAttemptToDomain(row, [])),
  };
}

/**
 * React hook to get attempts for a specific session
 */
export function useExerciseAttemptsBySession(
  sessionId: SessionId,
  userId?: string
) {
  const whereClause = userId
    ? `owner_id = '${userId}' AND session_id = '${sessionId}'`
    : `session_id = '${sessionId}'`;

  const result = useShape<DojoExerciseAttemptRow>({
    table: "dojo_exercise_attempts",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.map((row) => exerciseAttemptToDomain(row, [])),
  };
}

/**
 * React hook to get a single attempt by ID
 */
export function useExerciseAttempt(id: AttemptId | undefined) {
  const result = useShape<DojoExerciseAttemptRow>({
    table: "dojo_exercise_attempts",
    where: id ? `id = '${id}'` : undefined,
  });

  return {
    ...result,
    data: result.data?.[0]
      ? exerciseAttemptToDomain(result.data[0], [])
      : undefined,
  };
}

// =============================================================================
// Electric Read Hooks - Subtask Attempts
// =============================================================================

/**
 * React hook to get subtask attempts for an exercise attempt
 */
export function useSubtaskAttempts(attemptId: AttemptId | undefined) {
  const result = useShape<DojoSubtaskAttemptRow>({
    table: "dojo_subtask_attempts",
    where: attemptId ? `attempt_id = '${attemptId}'` : undefined,
  });

  return {
    ...result,
    data: result.data?.map(subtaskAttemptToDomain),
  };
}

/**
 * React hook to get an attempt with its subtask attempts
 */
export function useExerciseAttemptWithSubtasks(
  attemptId: AttemptId | undefined
) {
  const attemptResult = useShape<DojoExerciseAttemptRow>({
    table: "dojo_exercise_attempts",
    where: attemptId ? `id = '${attemptId}'` : undefined,
  });

  const subtasksResult = useShape<DojoSubtaskAttemptRow>({
    table: "dojo_subtask_attempts",
    where: attemptId ? `attempt_id = '${attemptId}'` : undefined,
  });

  const isLoading = attemptResult.isLoading || subtasksResult.isLoading;
  const error = attemptResult.error || subtasksResult.error;

  let data: ExerciseAttempt | undefined;

  if (attemptResult.data?.[0] && subtasksResult.data) {
    const subtaskAttempts = subtasksResult.data.map(subtaskAttemptToDomain);
    data = exerciseAttemptToDomain(attemptResult.data[0], subtaskAttempts);
  }

  return {
    isLoading,
    error,
    data,
    syncStatus: attemptResult.syncStatus,
    isFreshData: attemptResult.isFreshData && subtasksResult.isFreshData,
  };
}

// =============================================================================
// Write Operations
// =============================================================================

const buffer = createWriteBuffer();

/**
 * Create a new exercise attempt (in progress)
 */
export async function createExerciseAttempt(
  data: Omit<
    ExerciseAttempt,
    | "id"
    | "endedAt"
    | "totalSeconds"
    | "correctCount"
    | "partialCount"
    | "incorrectCount"
    | "accuracy"
  >,
  ownerId: string
): Promise<ExerciseAttempt> {
  const id = asAttemptId(crypto.randomUUID());

  // Create attempt with in-progress status
  const attempt: ExerciseAttempt = {
    ...data,
    id,
    endedAt: data.startedAt, // Will be updated when completed
    totalSeconds: 0,
    completionStatus: "in-progress",
  };

  const row = exerciseAttemptToRow(attempt);
  row.owner_id = ownerId;

  await buffer.enqueue({
    table: "dojo_exercise_attempts",
    op: "insert",
    payload: row,
  });

  logger.info("db.local", "Created exercise attempt (enqueued)", {
    attemptId: id,
    templateId: data.templateId,
    mode: data.mode,
  });

  return attempt;
}

/**
 * Complete an exercise attempt
 */
export async function completeExerciseAttempt(
  id: AttemptId,
  data: {
    endedAt: string;
    totalSeconds: number;
    subtaskAttempts: SubtaskAttempt[];
    completionStatus: "completed" | "abandoned";
    notes?: string;
    attachmentIds?: string[];
    overallDifficulty?: number;
    confidenceLevel?: number;
  },
  ownerId: string
): Promise<void> {
  // Calculate accuracy metrics
  const correctCount = data.subtaskAttempts.filter(
    (s) => s.result === "correct"
  ).length;
  const partialCount = data.subtaskAttempts.filter(
    (s) => s.result === "partially-correct"
  ).length;
  const incorrectCount = data.subtaskAttempts.filter(
    (s) => s.result === "incorrect"
  ).length;
  const totalSubtasks = data.subtaskAttempts.length;
  const accuracy =
    totalSubtasks > 0 ? (correctCount + partialCount * 0.5) / totalSubtasks : 0;

  // Update the attempt
  await buffer.enqueue({
    table: "dojo_exercise_attempts",
    op: "update",
    payload: {
      id,
      owner_id: ownerId,
      ended_at: data.endedAt,
      total_seconds: data.totalSeconds,
      completion_status: data.completionStatus,
      notes: data.notes ?? null,
      attachment_ids: data.attachmentIds ?? [],
      overall_difficulty: data.overallDifficulty,
      confidence_level: data.confidenceLevel,
      correct_count: correctCount,
      partial_count: partialCount,
      incorrect_count: incorrectCount,
      accuracy,
    },
  });

  // Create subtask attempts
  for (const subtaskAttempt of data.subtaskAttempts) {
    const subtaskRow = subtaskAttemptToRow(subtaskAttempt, id, ownerId);
    await buffer.enqueue({
      table: "dojo_subtask_attempts",
      op: "insert",
      payload: subtaskRow,
    });
  }

  logger.info("db.local", "Completed exercise attempt (enqueued)", {
    attemptId: id,
    completionStatus: data.completionStatus,
    accuracy,
  });
}

/**
 * Delete an exercise attempt
 */
export async function deleteExerciseAttempt(
  id: AttemptId,
  ownerId: string
): Promise<void> {
  await buffer.enqueue({
    table: "dojo_exercise_attempts",
    op: "delete",
    payload: { id, owner_id: ownerId },
  });

  logger.info("db.local", "Deleted exercise attempt (enqueued)", {
    attemptId: id,
  });
}
