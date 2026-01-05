/**
 * Dojo Exercise by ID API
 *
 * GET /api/dojo/exercises/[id] - Get a single exercise template
 * PUT /api/dojo/exercises/[id] - Update an exercise template
 * DELETE /api/dojo/exercises/[id] - Delete an exercise template
 */

import { NextRequest, NextResponse } from "next/server";
import { createPostgresPool } from "@/app/api/lib/postgres";
import { handleCorsOptions, addCorsHeaders } from "@/app/api/lib/cors";
import { requireAuth } from "@/app/api/lib/auth-helpers";
import { logger } from "@deeprecall/telemetry";
import { ExerciseTemplateUpdateSchema } from "@deeprecall/dojo-core";
import { exerciseTemplateToDomain } from "@deeprecall/dojo-data";
import type { DojoExerciseTemplateRow } from "@deeprecall/dojo-data";

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
 * GET /api/dojo/exercises/[id]
 * Get a single exercise template by ID
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    const result = await pool.query<DojoExerciseTemplateRow>(
      `SELECT * FROM dojo_exercise_templates WHERE id = $1 AND owner_id = $2`,
      [id, user.userId]
    );

    if (result.rows.length === 0) {
      return addCorsHeaders(
        NextResponse.json({ error: "Exercise not found" }, { status: 404 }),
        req
      );
    }

    const exercise = exerciseTemplateToDomain(result.rows[0]);

    logger.info("api.dojo", "Retrieved exercise", {
      userId: user.userId,
      exerciseId: id,
    });

    return addCorsHeaders(NextResponse.json({ exercise }), req);
  } catch (error) {
    logger.error("api.dojo", "Failed to get exercise", { error });

    if (error instanceof Error && error.message === "Authentication required") {
      return addCorsHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        req
      );
    }

    return addCorsHeaders(
      NextResponse.json({ error: "Failed to get exercise" }, { status: 500 }),
      req
    );
  }
}

/**
 * PUT /api/dojo/exercises/[id]
 * Update an exercise template
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();

    // Validate input (with id added)
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

    const data = parseResult.data;
    const now = new Date().toISOString();

    // Build dynamic update query
    const updates: string[] = ["updated_at = $2"];
    const values: (string | string[] | number | boolean | null)[] = [id, now];
    let paramIndex = 3;

    // Map of camelCase fields to snake_case columns
    const fieldMappings: Record<string, string> = {
      domainId: "domain_id",
      title: "title",
      description: "description",
      problemStatement: "problem_statement",
      primaryConceptIds: "primary_concept_ids",
      supportingConceptIds: "supporting_concept_ids",
      difficulty: "difficulty",
      importance: "importance",
      tags: "tags",
      isParameterized: "is_parameterized",
      variantGenerationNote: "variant_generation_note",
      relatedAnnotationIds: "related_annotation_ids",
      relatedDocumentIds: "related_document_ids",
      relatedBoardIds: "related_board_ids",
      source: "source",
      authorNotes: "author_notes",
    };

    for (const [key, column] of Object.entries(fieldMappings)) {
      if (key in data && key !== "id") {
        updates.push(`${column} = $${paramIndex}`);
        values.push((data as Record<string, unknown>)[key] as string);
        paramIndex++;
      }
    }

    // Handle special JSONB fields
    if ("subtasks" in data && data.subtasks) {
      updates.push(`subtasks_json = $${paramIndex}`);
      // Convert subtasks to DB format (snake_case)
      const dbSubtasks = data.subtasks.map((s) => ({
        id: s.id,
        label: s.label,
        prompt: s.prompt,
        hint_steps: s.hintSteps,
        solution_sketch: s.solutionSketch,
        full_solution: s.fullSolution,
        relative_difficulty: s.relativeDifficulty,
        expected_minutes: s.expectedMinutes,
      }));
      values.push(JSON.stringify(dbSubtasks));
      paramIndex++;
    }

    if ("parameterSchema" in data) {
      updates.push(`parameter_schema = $${paramIndex}`);
      values.push(
        data.parameterSchema ? JSON.stringify(data.parameterSchema) : null
      );
      paramIndex++;
    }

    // Also update concept_ids when primaryConceptIds changes (for backward compatibility)
    if ("primaryConceptIds" in data) {
      updates.push(`concept_ids = $${paramIndex}`);
      values.push(data.primaryConceptIds as string[]);
      paramIndex++;
    }

    // Add owner_id filter
    values.push(user.userId);

    const result = await pool.query<DojoExerciseTemplateRow>(
      `UPDATE dojo_exercise_templates 
       SET ${updates.join(", ")} 
       WHERE id = $1 AND owner_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return addCorsHeaders(
        NextResponse.json({ error: "Exercise not found" }, { status: 404 }),
        req
      );
    }

    const exercise = exerciseTemplateToDomain(result.rows[0]);

    logger.info("api.dojo", "Updated exercise", {
      userId: user.userId,
      exerciseId: id,
    });

    return addCorsHeaders(NextResponse.json({ exercise }), req);
  } catch (error) {
    logger.error("api.dojo", "Failed to update exercise", { error });

    if (error instanceof Error && error.message === "Authentication required") {
      return addCorsHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        req
      );
    }

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
 * DELETE /api/dojo/exercises/[id]
 * Delete an exercise template
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    // Delete in a transaction to handle cascade
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Delete associated scheduler items first
      await client.query(
        `DELETE FROM dojo_scheduler_items WHERE template_id = $1 AND owner_id = $2`,
        [id, user.userId]
      );

      // Delete exercise bricks
      await client.query(
        `DELETE FROM dojo_exercise_bricks WHERE template_id = $1 AND owner_id = $2`,
        [id, user.userId]
      );

      // Delete variants
      await client.query(
        `DELETE FROM dojo_exercise_variants WHERE template_id = $1 AND owner_id = $2`,
        [id, user.userId]
      );

      // Finally delete the exercise template
      const result = await client.query(
        `DELETE FROM dojo_exercise_templates WHERE id = $1 AND owner_id = $2 RETURNING id`,
        [id, user.userId]
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return addCorsHeaders(
          NextResponse.json({ error: "Exercise not found" }, { status: 404 }),
          req
        );
      }

      await client.query("COMMIT");

      logger.info("api.dojo", "Deleted exercise", {
        userId: user.userId,
        exerciseId: id,
      });

      return addCorsHeaders(NextResponse.json({ deleted: true, id }), req);
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error("api.dojo", "Failed to delete exercise", { error });

    if (error instanceof Error && error.message === "Authentication required") {
      return addCorsHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        req
      );
    }

    return addCorsHeaders(
      NextResponse.json(
        { error: "Failed to delete exercise" },
        { status: 500 }
      ),
      req
    );
  }
}
