/**
 * Dojo Attempt by ID API
 *
 * GET /api/dojo/attempts/[id] - Get a single attempt with subtasks
 * PUT /api/dojo/attempts/[id] - Complete or update an attempt
 * DELETE /api/dojo/attempts/[id] - Delete an attempt
 */

import { NextRequest, NextResponse } from "next/server";
import { createPostgresPool } from "@/app/api/lib/postgres";
import { handleCorsOptions, addCorsHeaders } from "@/app/api/lib/cors";
import { requireAuth } from "@/app/api/lib/auth-helpers";
import { logger } from "@deeprecall/telemetry";
import {
  ExerciseAttemptCompleteSchema,
  computeAttemptAccuracy,
  asSubtaskId,
} from "@deeprecall/dojo-core";
import {
  exerciseAttemptToDomain,
  subtaskAttemptToDomain,
  subtaskAttemptToRow,
} from "@deeprecall/dojo-data";
import type {
  DojoExerciseAttemptRow,
  DojoSubtaskAttemptRow,
} from "@deeprecall/dojo-data";

const pool = createPostgresPool();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

/**
 * GET /api/dojo/attempts/[id]
 * Get a single attempt with subtask attempts
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    // Get the attempt
    const attemptResult = await pool.query<DojoExerciseAttemptRow>(
      `SELECT * FROM dojo_exercise_attempts WHERE id = $1 AND owner_id = $2`,
      [id, user.userId]
    );

    if (attemptResult.rows.length === 0) {
      return addCorsHeaders(
        NextResponse.json({ error: "Attempt not found" }, { status: 404 }),
        req
      );
    }

    // Get subtask attempts
    const subtasksResult = await pool.query<DojoSubtaskAttemptRow>(
      `SELECT * FROM dojo_subtask_attempts WHERE attempt_id = $1`,
      [id]
    );

    const subtaskAttempts = subtasksResult.rows.map(subtaskAttemptToDomain);
    const attempt = exerciseAttemptToDomain(
      attemptResult.rows[0],
      subtaskAttempts
    );

    logger.info("api.dojo", "Retrieved attempt", {
      userId: user.userId,
      attemptId: id,
    });

    return addCorsHeaders(NextResponse.json({ attempt }), req);
  } catch (error) {
    logger.error("api.dojo", "Failed to get attempt", { error });

    if (error instanceof Error && error.message === "Authentication required") {
      return addCorsHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        req
      );
    }

    return addCorsHeaders(
      NextResponse.json({ error: "Failed to get attempt" }, { status: 500 }),
      req
    );
  }
}

/**
 * PUT /api/dojo/attempts/[id]
 * Complete an attempt with results
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();

    // Validate input
    const parseResult = ExerciseAttemptCompleteSchema.safeParse({
      ...body,
      id,
    });
    if (!parseResult.success) {
      return addCorsHeaders(
        NextResponse.json(
          {
            error: "Invalid attempt completion data",
            details: parseResult.error.issues,
          },
          { status: 400 }
        ),
        req
      );
    }

    const data = parseResult.data;

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Check attempt exists and belongs to user
      const checkResult = await client.query<DojoExerciseAttemptRow>(
        `SELECT * FROM dojo_exercise_attempts WHERE id = $1 AND owner_id = $2`,
        [id, user.userId]
      );

      if (checkResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return addCorsHeaders(
          NextResponse.json({ error: "Attempt not found" }, { status: 404 }),
          req
        );
      }

      // Convert subtask attempts with branded IDs
      const subtaskAttemptsWithBrandedIds = data.subtaskAttempts.map((s) => ({
        ...s,
        subtaskId: asSubtaskId(s.subtaskId),
      }));

      // Compute accuracy and counts from subtask attempts
      const accuracy = computeAttemptAccuracy(subtaskAttemptsWithBrandedIds);
      const correctCount = subtaskAttemptsWithBrandedIds.filter(
        (s) => s.result === "correct"
      ).length;
      const partialCount = subtaskAttemptsWithBrandedIds.filter(
        (s) => s.result === "partially-correct"
      ).length;
      const incorrectCount = subtaskAttemptsWithBrandedIds.filter(
        (s) => s.result === "incorrect"
      ).length;
      const hintsUsed = subtaskAttemptsWithBrandedIds.filter(
        (s) => s.usedHints
      ).length;
      const solutionViewed = subtaskAttemptsWithBrandedIds.some(
        (s) => s.revealedSolution
      );

      // Delete existing subtask attempts (in case of update)
      await client.query(
        `DELETE FROM dojo_subtask_attempts WHERE attempt_id = $1`,
        [id]
      );

      // Insert subtask attempts
      for (const subtask of subtaskAttemptsWithBrandedIds) {
        const subtaskRow = subtaskAttemptToRow(subtask, id, user.userId);
        await client.query(
          `INSERT INTO dojo_subtask_attempts (
            id, owner_id, attempt_id, subtask_id, result,
            self_difficulty, error_types, used_hints, hints_revealed,
            revealed_solution, time_seconds, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            subtaskRow.id,
            subtaskRow.owner_id,
            subtaskRow.attempt_id,
            subtaskRow.subtask_id,
            subtaskRow.result,
            subtaskRow.self_difficulty,
            subtaskRow.error_types,
            subtaskRow.used_hints,
            subtaskRow.hints_revealed,
            subtaskRow.revealed_solution,
            subtaskRow.time_seconds,
            subtaskRow.notes,
          ]
        );
      }

      // Update the attempt
      const updateResult = await client.query<DojoExerciseAttemptRow>(
        `UPDATE dojo_exercise_attempts SET
          ended_at = $2,
          total_seconds = $3,
          completion_status = $4,
          notes = $5,
          attachment_ids = $6,
          overall_difficulty = $7,
          confidence_level = $8,
          correct_count = $9,
          partial_count = $10,
          incorrect_count = $11,
          accuracy = $12,
          hints_used = $13,
          solution_viewed = $14
        WHERE id = $1 AND owner_id = $15
        RETURNING *`,
        [
          id,
          data.endedAt,
          data.totalSeconds,
          data.completionStatus,
          data.notes || null,
          data.attachmentIds || [],
          data.overallDifficulty || null,
          data.confidenceLevel || null,
          correctCount,
          partialCount,
          incorrectCount,
          accuracy,
          hintsUsed,
          solutionViewed,
          user.userId,
        ]
      );

      await client.query("COMMIT");

      // Get the completed attempt with subtasks
      const subtasksResult = await pool.query<DojoSubtaskAttemptRow>(
        `SELECT * FROM dojo_subtask_attempts WHERE attempt_id = $1`,
        [id]
      );

      const subtaskAttempts = subtasksResult.rows.map(subtaskAttemptToDomain);
      const attempt = exerciseAttemptToDomain(
        updateResult.rows[0],
        subtaskAttempts
      );

      logger.info("api.dojo", "Completed attempt", {
        userId: user.userId,
        attemptId: id,
        completionStatus: data.completionStatus,
        accuracy,
      });

      return addCorsHeaders(NextResponse.json({ attempt }), req);
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error("api.dojo", "Failed to complete attempt", { error });

    if (error instanceof Error && error.message === "Authentication required") {
      return addCorsHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        req
      );
    }

    return addCorsHeaders(
      NextResponse.json(
        { error: "Failed to complete attempt" },
        { status: 500 }
      ),
      req
    );
  }
}

/**
 * DELETE /api/dojo/attempts/[id]
 * Delete an attempt
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    // Delete subtask attempts first (cascade)
    await pool.query(
      `DELETE FROM dojo_subtask_attempts WHERE attempt_id = $1 AND owner_id = $2`,
      [id, user.userId]
    );

    const result = await pool.query(
      `DELETE FROM dojo_exercise_attempts WHERE id = $1 AND owner_id = $2 RETURNING id`,
      [id, user.userId]
    );

    if (result.rows.length === 0) {
      return addCorsHeaders(
        NextResponse.json({ error: "Attempt not found" }, { status: 404 }),
        req
      );
    }

    logger.info("api.dojo", "Deleted attempt", {
      userId: user.userId,
      attemptId: id,
    });

    return addCorsHeaders(NextResponse.json({ deleted: true, id }), req);
  } catch (error) {
    logger.error("api.dojo", "Failed to delete attempt", { error });

    if (error instanceof Error && error.message === "Authentication required") {
      return addCorsHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        req
      );
    }

    return addCorsHeaders(
      NextResponse.json({ error: "Failed to delete attempt" }, { status: 500 }),
      req
    );
  }
}
