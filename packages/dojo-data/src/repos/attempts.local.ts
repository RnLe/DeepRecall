/**
 * Attempts Local Repository (Optimistic Layer)
 *
 * Instant writes to Dexie, queued for background sync via WriteBuffer.
 * Handles both ExerciseAttempts and SubtaskAttempts.
 */

import type {
  ExerciseAttempt,
  ExerciseAttemptCreate,
  AttemptId,
  SubtaskAttempt,
} from "@deeprecall/dojo-core";
import { asAttemptId } from "@deeprecall/dojo-core";
import { createWriteBuffer, isAuthenticated } from "@deeprecall/data";
import { logger } from "@deeprecall/telemetry";
import { dojoDb } from "../db";
import { exerciseAttemptToRow, subtaskAttemptToRow } from "../mappers";

const buffer = createWriteBuffer();

/**
 * Create a new exercise attempt with its subtask attempts (instant local write)
 */
export async function createExerciseAttemptLocal(
  input: ExerciseAttemptCreate,
  ownerId: string
): Promise<ExerciseAttempt> {
  const now = new Date().toISOString();
  const id = asAttemptId(crypto.randomUUID());

  const attempt: ExerciseAttempt = {
    ...input,
    id,
    userId: input.userId,
    completionStatus: "in-progress",
    startedAt: now,
    endedAt: now,
    totalSeconds: 0,
    subtaskAttempts: input.subtaskAttempts ?? [],
  };

  const attemptRow = exerciseAttemptToRow(attempt);
  attemptRow.owner_id = ownerId;

  // Write attempt to local table (instant)
  await dojoDb.dojo_exercise_attempts_local.add({
    id: attempt.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: attemptRow,
  });

  // Write subtask attempts to local table (instant)
  for (const subtaskAttempt of attempt.subtaskAttempts) {
    const subtaskRow = subtaskAttemptToRow(subtaskAttempt, attempt.id, ownerId);
    await dojoDb.dojo_subtask_attempts_local.add({
      id: subtaskRow.id,
      _op: "insert",
      _status: "pending",
      _timestamp: Date.now(),
      data: subtaskRow,
    });
  }

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_exercise_attempts",
      op: "insert",
      payload: attemptRow,
    });

    // Enqueue subtask attempts
    for (const subtaskAttempt of attempt.subtaskAttempts) {
      const subtaskRow = subtaskAttemptToRow(
        subtaskAttempt,
        attempt.id,
        ownerId
      );
      await buffer.enqueue({
        table: "dojo_subtask_attempts",
        op: "insert",
        payload: subtaskRow,
      });
    }
  }

  logger.info("db.local", "Created exercise attempt (pending sync)", {
    attemptId: id,
    templateId: input.templateId,
    subtaskCount: attempt.subtaskAttempts.length,
    willSync: isAuthenticated(),
  });

  return attempt;
}

/**
 * Complete an exercise attempt (instant local write)
 */
export async function completeExerciseAttemptLocal(
  id: AttemptId,
  updates: {
    endedAt: string;
    totalSeconds: number;
    subtaskAttempts: SubtaskAttempt[];
    notes?: string;
    overallDifficulty?: number;
    confidenceLevel?: number;
  },
  ownerId: string
): Promise<void> {
  // Calculate accuracy metrics from subtask attempts
  let correctCount = 0;
  let partialCount = 0;
  let incorrectCount = 0;

  for (const subtask of updates.subtaskAttempts) {
    if (subtask.result === "correct") correctCount++;
    else if (subtask.result === "partially-correct") partialCount++;
    else if (subtask.result === "incorrect") incorrectCount++;
  }

  const total = correctCount + partialCount + incorrectCount;
  const accuracy = total > 0 ? (correctCount + partialCount * 0.5) / total : 0;

  const payload = {
    id,
    owner_id: ownerId,
    ended_at: updates.endedAt,
    total_seconds: updates.totalSeconds,
    completion_status: "completed" as const,
    notes: updates.notes ?? null,
    overall_difficulty: updates.overallDifficulty,
    confidence_level: updates.confidenceLevel,
    correct_count: correctCount,
    partial_count: partialCount,
    incorrect_count: incorrectCount,
    accuracy,
  };

  // Write to local table (instant)
  await dojoDb.dojo_exercise_attempts_local.add({
    id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: payload as any,
  });

  // Update subtask attempts
  for (const subtaskAttempt of updates.subtaskAttempts) {
    const subtaskRow = subtaskAttemptToRow(subtaskAttempt, id, ownerId);
    await dojoDb.dojo_subtask_attempts_local.add({
      id: subtaskRow.id,
      _op: "update",
      _status: "pending",
      _timestamp: Date.now(),
      data: subtaskRow,
    });
  }

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_exercise_attempts",
      op: "update",
      payload,
    });

    // Update subtask attempts
    for (const subtaskAttempt of updates.subtaskAttempts) {
      const subtaskRow = subtaskAttemptToRow(subtaskAttempt, id, ownerId);
      await buffer.enqueue({
        table: "dojo_subtask_attempts",
        op: "update",
        payload: subtaskRow,
      });
    }
  }

  logger.info("db.local", "Completed exercise attempt (pending sync)", {
    attemptId: id,
    totalSeconds: updates.totalSeconds,
    accuracy,
    willSync: isAuthenticated(),
  });
}

/**
 * Delete an exercise attempt (instant local write)
 */
export async function deleteExerciseAttemptLocal(
  id: AttemptId,
  ownerId: string
): Promise<void> {
  // Write to local table (instant)
  await dojoDb.dojo_exercise_attempts_local.add({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
  });

  // Note: Subtask attempts are deleted via CASCADE on the server

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_exercise_attempts",
      op: "delete",
      payload: { id, owner_id: ownerId },
    });
  }

  logger.info("db.local", "Deleted exercise attempt (pending sync)", {
    attemptId: id,
    willSync: isAuthenticated(),
  });
}
