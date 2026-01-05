/**
 * Admin Dojo Exercise by ID API
 *
 * GET /api/admin/dojo/exercises/[id] - Get a specific exercise
 * PUT /api/admin/dojo/exercises/[id] - Update an exercise
 * DELETE /api/admin/dojo/exercises/[id] - Delete an exercise
 */

import { NextRequest, NextResponse } from "next/server";
import { createPostgresPool } from "@/app/api/lib/postgres";
import { handleCorsOptions, addCorsHeaders } from "@/app/api/lib/cors";
import {
  requireAdmin,
  adminUnauthorizedResponse,
} from "@/app/api/lib/admin-auth";
import { logger } from "@deeprecall/telemetry";
import {
  ExerciseTemplateUpdateSchema,
  asSubtaskId,
} from "@deeprecall/dojo-core";
import { exerciseTemplateToDomain } from "@deeprecall/dojo-data/mappers";
import type {
  DojoExerciseTemplateRow,
  DbExerciseSubtask,
} from "@deeprecall/dojo-data/types";

const pool = createPostgresPool();

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

/**
 * GET /api/admin/dojo/exercises/[id]
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    requireAdmin(req);
    const { id } = await params;

    const result = await pool.query<
      DojoExerciseTemplateRow & { is_global: boolean }
    >(`SELECT *, is_global FROM dojo_exercise_templates WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return addCorsHeaders(
        NextResponse.json({ error: "Exercise not found" }, { status: 404 }),
        req
      );
    }

    const row = result.rows[0];
    const exercise = {
      ...exerciseTemplateToDomain(row),
      isGlobal: row.is_global,
      ownerId: row.owner_id,
    };

    return addCorsHeaders(NextResponse.json({ exercise }), req);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Admin authentication required"
    ) {
      return adminUnauthorizedResponse(req);
    }

    logger.error("api.dojo", "Failed to get exercise", { error });
    return addCorsHeaders(
      NextResponse.json({ error: "Failed to get exercise" }, { status: 500 }),
      req
    );
  }
}

/**
 * PUT /api/admin/dojo/exercises/[id]
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const body = await req.json();
    requireAdmin(req, body);
    const { id } = await params;

    // First check if exercise exists and is global
    const existing = await pool.query<{ is_global: boolean }>(
      `SELECT is_global FROM dojo_exercise_templates WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return addCorsHeaders(
        NextResponse.json({ error: "Exercise not found" }, { status: 404 }),
        req
      );
    }

    if (!existing.rows[0].is_global) {
      return addCorsHeaders(
        NextResponse.json(
          { error: "Cannot edit user-owned content via admin API" },
          { status: 403 }
        ),
        req
      );
    }

    // Validate update data
    const parseResult = ExerciseTemplateUpdateSchema.safeParse({ ...body, id });
    if (!parseResult.success) {
      return addCorsHeaders(
        NextResponse.json(
          { error: "Invalid exercise data", details: parseResult.error.issues },
          { status: 400 }
        ),
        req
      );
    }

    const updates = parseResult.data;
    const now = new Date().toISOString();

    // Build dynamic UPDATE query
    const setClauses: string[] = ["updated_at = $2"];
    const queryParams: unknown[] = [id, now];
    let paramIndex = 3;

    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex}`);
      queryParams.push(updates.title);
      paramIndex++;
    }

    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      queryParams.push(updates.description);
      paramIndex++;
    }

    if (updates.problemStatement !== undefined) {
      setClauses.push(`problem_statement = $${paramIndex}`);
      queryParams.push(updates.problemStatement);
      paramIndex++;
    }

    if (updates.domainId !== undefined) {
      setClauses.push(`domain_id = $${paramIndex}`);
      queryParams.push(updates.domainId);
      paramIndex++;
    }

    if (updates.difficulty !== undefined) {
      setClauses.push(`difficulty = $${paramIndex}`);
      queryParams.push(updates.difficulty);
      paramIndex++;
    }

    if (updates.importance !== undefined) {
      setClauses.push(`importance = $${paramIndex}`);
      queryParams.push(updates.importance);
      paramIndex++;
    }

    if (
      updates.primaryConceptIds !== undefined ||
      updates.supportingConceptIds !== undefined
    ) {
      const primary = updates.primaryConceptIds || [];
      const supporting = updates.supportingConceptIds || [];
      setClauses.push(`concept_ids = $${paramIndex}`);
      queryParams.push([...primary, ...supporting]);
      paramIndex++;
    }

    if (updates.tags !== undefined) {
      setClauses.push(`tags = $${paramIndex}`);
      queryParams.push(updates.tags);
      paramIndex++;
    }

    if (updates.subtasks !== undefined) {
      // Ensure subtasks have IDs
      const subtasksWithIds: DbExerciseSubtask[] = updates.subtasks.map(
        (st, index) => ({
          id: st.id || asSubtaskId(`${id}-subtask-${index + 1}`),
          prompt: st.prompt,
          label: st.label,
          hint_steps: st.hintSteps,
          solution_sketch: st.solutionSketch,
          full_solution: st.fullSolution,
          relative_difficulty: st.relativeDifficulty,
          expected_minutes: st.expectedMinutes,
        })
      );
      setClauses.push(`subtasks_json = $${paramIndex}`);
      queryParams.push(JSON.stringify(subtasksWithIds));
      paramIndex++;
    }

    if (updates.isParameterized !== undefined) {
      setClauses.push(`is_parameterized = $${paramIndex}`);
      queryParams.push(updates.isParameterized);
      paramIndex++;
    }

    if (updates.parameterSchema !== undefined) {
      setClauses.push(`parameter_schema = $${paramIndex}`);
      queryParams.push(JSON.stringify(updates.parameterSchema));
      paramIndex++;
    }

    if (updates.variantGenerationNote !== undefined) {
      setClauses.push(`variant_generation_note = $${paramIndex}`);
      queryParams.push(updates.variantGenerationNote);
      paramIndex++;
    }

    if (updates.source !== undefined) {
      setClauses.push(`source = $${paramIndex}`);
      queryParams.push(updates.source);
      paramIndex++;
    }

    if (updates.authorNotes !== undefined) {
      setClauses.push(`author_notes = $${paramIndex}`);
      queryParams.push(updates.authorNotes);
      paramIndex++;
    }

    const result = await pool.query<
      DojoExerciseTemplateRow & { is_global: boolean }
    >(
      `UPDATE dojo_exercise_templates 
       SET ${setClauses.join(", ")} 
       WHERE id = $1 
       RETURNING *, is_global`,
      queryParams
    );

    const row = result.rows[0];
    const exercise = {
      ...exerciseTemplateToDomain(row),
      isGlobal: row.is_global,
      ownerId: row.owner_id,
    };

    logger.info("api.dojo", "Updated exercise", {
      exerciseId: id,
      updates: Object.keys(updates),
    });

    return addCorsHeaders(NextResponse.json({ exercise }), req);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Admin authentication required"
    ) {
      return adminUnauthorizedResponse(req);
    }

    logger.error("api.dojo", "Failed to update exercise", { error });
    return addCorsHeaders(
      NextResponse.json(
        { error: "Failed to update exercise" },
        { status: 500 }
      ),
      req
    );
  }
}

/**
 * DELETE /api/admin/dojo/exercises/[id]
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    requireAdmin(req);
    const { id } = await params;

    // First check if exercise exists and is global
    const existing = await pool.query<{ is_global: boolean; title: string }>(
      `SELECT is_global, title FROM dojo_exercise_templates WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return addCorsHeaders(
        NextResponse.json({ error: "Exercise not found" }, { status: 404 }),
        req
      );
    }

    if (!existing.rows[0].is_global) {
      return addCorsHeaders(
        NextResponse.json(
          { error: "Cannot delete user-owned content via admin API" },
          { status: 403 }
        ),
        req
      );
    }

    // Check for user attempts on this exercise
    const attempts = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM dojo_exercise_attempts WHERE template_id = $1`,
      [id]
    );

    const attemptCount = parseInt(attempts.rows[0].count);
    if (attemptCount > 0) {
      // Soft-warning: allow deletion but notify
      logger.warn("api.dojo", "Deleting exercise with user attempts", {
        exerciseId: id,
        attemptCount,
      });
    }

    await pool.query(`DELETE FROM dojo_exercise_templates WHERE id = $1`, [id]);

    logger.info("api.dojo", "Deleted exercise", {
      exerciseId: id,
      title: existing.rows[0].title,
      attemptCount,
    });

    return addCorsHeaders(
      NextResponse.json({ success: true, deleted: id, attemptCount }),
      req
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Admin authentication required"
    ) {
      return adminUnauthorizedResponse(req);
    }

    logger.error("api.dojo", "Failed to delete exercise", { error });
    return addCorsHeaders(
      NextResponse.json(
        { error: "Failed to delete exercise" },
        { status: 500 }
      ),
      req
    );
  }
}
