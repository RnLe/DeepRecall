/**
 * Admin Dojo Exercises API
 *
 * GET /api/admin/dojo/exercises - List all global exercises
 * POST /api/admin/dojo/exercises - Create a new global exercise
 */

import { NextRequest, NextResponse } from "next/server";
import { createPostgresPool } from "@/app/api/lib/postgres";
import { handleCorsOptions, addCorsHeaders } from "@/app/api/lib/cors";
import {
  requireAdmin,
  adminUnauthorizedResponse,
  getSystemUserId,
} from "@/app/api/lib/admin-auth";
import { logger } from "@deeprecall/telemetry";
import {
  ExerciseTemplateCreateSchema,
  asExerciseTemplateId,
  asSubtaskId,
  asConceptNodeId,
} from "@deeprecall/dojo-core";
import type { ExerciseTemplate } from "@deeprecall/dojo-core";
import {
  exerciseTemplateToDomain,
  exerciseTemplateToRow,
} from "@deeprecall/dojo-data/mappers";
import type { DojoExerciseTemplateRow } from "@deeprecall/dojo-data/types";

const pool = createPostgresPool();

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

/**
 * GET /api/admin/dojo/exercises
 * List all global exercises (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const domainId = searchParams.get("domainId");
    const conceptId = searchParams.get("conceptId");
    const includeUserContent =
      searchParams.get("includeUserContent") === "true";

    // Build query - get global content, optionally all content
    const conditions: string[] = [];
    const params: (string | boolean)[] = [];
    let paramIndex = 1;

    if (!includeUserContent) {
      conditions.push(`is_global = $${paramIndex}`);
      params.push(true);
      paramIndex++;
    }

    if (domainId) {
      conditions.push(`domain_id = $${paramIndex}`);
      params.push(domainId);
      paramIndex++;
    }

    if (conceptId) {
      conditions.push(`$${paramIndex} = ANY(concept_ids)`);
      params.push(conceptId);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query<
      DojoExerciseTemplateRow & { is_global: boolean }
    >(
      `SELECT *, is_global FROM dojo_exercise_templates ${whereClause} ORDER BY domain_id, title`,
      params
    );

    const exercises = result.rows.map((row) => ({
      ...exerciseTemplateToDomain(row),
      isGlobal: row.is_global,
      ownerId: row.owner_id,
    }));

    // Get domain summary
    const domainSummary = await pool.query<{
      domain_id: string;
      count: number;
    }>(
      `SELECT domain_id, COUNT(*) as count 
       FROM dojo_exercise_templates 
       WHERE is_global = true 
       GROUP BY domain_id 
       ORDER BY domain_id`
    );

    logger.info("api.dojo", "Listed global exercises", {
      count: exercises.length,
      domains: domainSummary.rows,
    });

    return addCorsHeaders(
      NextResponse.json({
        exercises,
        count: exercises.length,
        domains: domainSummary.rows,
      }),
      req
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Admin authentication required"
    ) {
      return adminUnauthorizedResponse(req);
    }

    logger.error("api.dojo", "Failed to list exercises", { error });
    return addCorsHeaders(
      NextResponse.json({ error: "Failed to list exercises" }, { status: 500 }),
      req
    );
  }
}

/**
 * POST /api/admin/dojo/exercises
 * Create a new global exercise
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    requireAdmin(req, body);

    // Validate input
    const parseResult = ExerciseTemplateCreateSchema.safeParse(body);
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
    const id = asExerciseTemplateId(crypto.randomUUID());
    const systemUserId = getSystemUserId();

    // Generate subtask IDs
    const subtasksWithIds = data.subtasks.map((st, index) => ({
      ...st,
      id: asSubtaskId(`${id}-subtask-${index + 1}`),
    }));

    // Create exercise object - explicitly construct to ensure correct types
    const exercise: ExerciseTemplate = {
      id,
      domainId: data.domainId,
      title: data.title,
      description: data.description,
      problemStatement: data.problemStatement,
      subtasks: subtasksWithIds,
      primaryConceptIds: data.primaryConceptIds.map(asConceptNodeId),
      supportingConceptIds: data.supportingConceptIds?.map(asConceptNodeId),
      exerciseKind: data.exerciseKind,
      difficulty: data.difficulty,
      importance: data.importance,
      tags: data.tags,
      isParameterized: data.isParameterized,
      parameterSchema: data.parameterSchema,
      variantGenerationNote: data.variantGenerationNote,
      relatedAnnotationIds: data.relatedAnnotationIds,
      relatedDocumentIds: data.relatedDocumentIds,
      relatedBoardIds: data.relatedBoardIds,
      source: data.source,
      authorNotes: data.authorNotes,
      createdAt: now,
      updatedAt: now,
    };

    // Convert to DB row
    const row = exerciseTemplateToRow(exercise, systemUserId);

    // Insert into database with is_global = true
    await pool.query(
      `INSERT INTO dojo_exercise_templates (
        id, owner_id, domain_id, title, description, problem_statement,
        concept_ids, exercise_kind, difficulty, importance, tags, subtasks_json,
        is_parameterized, parameter_schema, variant_generation_note,
        related_annotation_ids, related_document_ids, related_board_ids,
        source, author_notes, created_at, updated_at, is_global
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
      [
        row.id,
        row.owner_id,
        row.domain_id,
        row.title,
        row.description,
        row.problem_statement,
        row.concept_ids,
        row.exercise_kind,
        row.difficulty,
        row.importance,
        row.tags,
        row.subtasks_json,
        row.is_parameterized,
        row.parameter_schema,
        row.variant_generation_note,
        row.related_annotation_ids,
        row.related_document_ids,
        row.related_board_ids,
        row.source,
        row.author_notes,
        row.created_at,
        row.updated_at,
        true, // is_global
      ]
    );

    logger.info("api.dojo", "Created global exercise", {
      exerciseId: id,
      title: exercise.title,
      domainId: exercise.domainId,
      subtaskCount: exercise.subtasks.length,
    });

    return addCorsHeaders(
      NextResponse.json(
        { exercise: { ...exercise, isGlobal: true } },
        { status: 201 }
      ),
      req
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Admin authentication required"
    ) {
      return adminUnauthorizedResponse(req);
    }

    logger.error("api.dojo", "Failed to create exercise", { error });
    return addCorsHeaders(
      NextResponse.json(
        { error: "Failed to create exercise" },
        { status: 500 }
      ),
      req
    );
  }
}
