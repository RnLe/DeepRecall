/**
 * Dojo Attempts API
 *
 * GET /api/dojo/attempts - List all attempts (with optional filters)
 * POST /api/dojo/attempts - Create a new attempt (start an exercise)
 */

import { NextRequest, NextResponse } from "next/server";
import { createPostgresPool } from "@/app/api/lib/postgres";
import { handleCorsOptions, addCorsHeaders } from "@/app/api/lib/cors";
import { requireAuth } from "@/app/api/lib/auth-helpers";
import { logger } from "@deeprecall/telemetry";
import {
  ExerciseAttemptCreateSchema,
  asAttemptId,
  asUserId,
} from "@deeprecall/dojo-core";
import {
  exerciseAttemptToDomain,
  subtaskAttemptToDomain,
} from "@deeprecall/dojo-data/mappers";
import type {
  DojoExerciseAttemptRow,
  DojoSubtaskAttemptRow,
} from "@deeprecall/dojo-data/types";

const pool = createPostgresPool();

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

/**
 * GET /api/dojo/attempts
 * List attempts with optional filtering
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const templateId = searchParams.get("templateId");
    const sessionId = searchParams.get("sessionId");
    const mode = searchParams.get("mode");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");

    // Build query with filters
    const conditions: string[] = ["a.owner_id = $1"];
    const params: (string | number)[] = [user.userId];
    let paramIndex = 2;

    if (templateId) {
      conditions.push(`a.template_id = $${paramIndex}`);
      params.push(templateId);
      paramIndex++;
    }

    if (sessionId) {
      conditions.push(`a.session_id = $${paramIndex}`);
      params.push(sessionId);
      paramIndex++;
    }

    if (mode) {
      conditions.push(`a.mode = $${paramIndex}`);
      params.push(mode);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");
    const limitVal = limit ? parseInt(limit, 10) : 50;
    const offsetVal = offset ? parseInt(offset, 10) : 0;

    // Get attempts
    const attemptsResult = await pool.query<DojoExerciseAttemptRow>(
      `SELECT a.* FROM dojo_exercise_attempts a 
       WHERE ${whereClause} 
       ORDER BY a.started_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limitVal, offsetVal]
    );

    // Get subtask attempts for these attempts
    const attemptIds = attemptsResult.rows.map((r) => r.id);
    const subtasksByAttempt: Map<string, DojoSubtaskAttemptRow[]> = new Map();

    if (attemptIds.length > 0) {
      const subtasksResult = await pool.query<DojoSubtaskAttemptRow>(
        `SELECT * FROM dojo_subtask_attempts WHERE attempt_id = ANY($1)`,
        [attemptIds]
      );

      for (const row of subtasksResult.rows) {
        const existing = subtasksByAttempt.get(row.attempt_id) || [];
        existing.push(row);
        subtasksByAttempt.set(row.attempt_id, existing);
      }
    }

    // Map to domain objects
    const attempts = attemptsResult.rows.map((row) => {
      const subtaskRows = subtasksByAttempt.get(row.id) || [];
      const subtaskAttempts = subtaskRows.map(subtaskAttemptToDomain);
      return exerciseAttemptToDomain(row, subtaskAttempts);
    });

    logger.info("api.dojo", "Listed attempts", {
      userId: user.userId,
      count: attempts.length,
      filters: {
        templateId,
        sessionId,
        mode,
        limit: limitVal,
        offset: offsetVal,
      },
    });

    return addCorsHeaders(
      NextResponse.json({ attempts, count: attempts.length }),
      req
    );
  } catch (error) {
    logger.error("api.dojo", "Failed to list attempts", { error });

    if (error instanceof Error && error.message === "Authentication required") {
      return addCorsHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        req
      );
    }

    return addCorsHeaders(
      NextResponse.json({ error: "Failed to list attempts" }, { status: 500 }),
      req
    );
  }
}

/**
 * POST /api/dojo/attempts
 * Start a new attempt
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();

    // Override userId with authenticated user
    const attemptData = {
      ...body,
      userId: user.userId,
    };

    // Validate input
    const parseResult = ExerciseAttemptCreateSchema.safeParse(attemptData);
    if (!parseResult.success) {
      return addCorsHeaders(
        NextResponse.json(
          { error: "Invalid attempt data", details: parseResult.error.issues },
          { status: 400 }
        ),
        req
      );
    }

    const data = parseResult.data;
    const id = asAttemptId(crypto.randomUUID());
    const startedAt = data.startedAt || new Date().toISOString();

    // Verify the exercise template exists
    const templateCheck = await pool.query(
      `SELECT id FROM dojo_exercise_templates WHERE id = $1 AND owner_id = $2`,
      [data.templateId, user.userId]
    );

    if (templateCheck.rows.length === 0) {
      return addCorsHeaders(
        NextResponse.json(
          { error: "Exercise template not found" },
          { status: 404 }
        ),
        req
      );
    }

    // Insert the attempt (in-progress state)
    await pool.query(
      `INSERT INTO dojo_exercise_attempts (
        id, owner_id, template_id, variant_id, session_id,
        mode, attempt_type, started_at, ended_at, total_seconds,
        completion_status, hints_used, solution_viewed, attachment_ids, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, 0, 'in-progress', 0, false, '{}', $8)`,
      [
        id,
        user.userId,
        data.templateId,
        data.variantId || null,
        data.sessionId || null,
        data.mode,
        data.attemptType,
        startedAt,
      ]
    );

    // Create a partial attempt object to return
    const attempt = {
      id,
      userId: asUserId(user.userId),
      templateId: data.templateId,
      variantId: data.variantId,
      sessionId: data.sessionId,
      mode: data.mode,
      attemptType: data.attemptType,
      startedAt,
      endedAt: startedAt,
      totalSeconds: 0,
      subtaskAttempts: [],
      completionStatus: "in-progress" as const,
    };

    logger.info("api.dojo", "Started attempt", {
      userId: user.userId,
      attemptId: id,
      templateId: data.templateId,
      mode: data.mode,
    });

    return addCorsHeaders(NextResponse.json({ attempt }, { status: 201 }), req);
  } catch (error) {
    logger.error("api.dojo", "Failed to create attempt", { error });

    if (error instanceof Error && error.message === "Authentication required") {
      return addCorsHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        req
      );
    }

    return addCorsHeaders(
      NextResponse.json({ error: "Failed to create attempt" }, { status: 500 }),
      req
    );
  }
}
