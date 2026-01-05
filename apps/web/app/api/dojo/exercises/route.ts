/**
 * Dojo Exercises API
 *
 * GET /api/dojo/exercises - List all exercise templates (with optional filters)
 * POST /api/dojo/exercises - Create a new exercise template
 */

import { NextRequest, NextResponse } from "next/server";
import { createPostgresPool } from "@/app/api/lib/postgres";
import { handleCorsOptions, addCorsHeaders } from "@/app/api/lib/cors";
import { requireAuth } from "@/app/api/lib/auth-helpers";
import { logger } from "@deeprecall/telemetry";
import {
  ExerciseTemplateCreateSchema,
  asExerciseTemplateId,
  asExerciseVariantId,
  asConceptNodeId,
  generateSubtaskId,
} from "@deeprecall/dojo-core";
import {
  exerciseTemplateToDomain,
  exerciseTemplateToRow,
} from "@deeprecall/dojo-data";
import type { DojoExerciseTemplateRow } from "@deeprecall/dojo-data";

const pool = createPostgresPool();

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

/**
 * GET /api/dojo/exercises
 * List exercise templates with optional filtering
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const domainId = searchParams.get("domainId");
    const conceptId = searchParams.get("conceptId");
    const difficulty = searchParams.get("difficulty");
    const importance = searchParams.get("importance");
    const tag = searchParams.get("tag");
    const search = searchParams.get("search");

    // Build query with filters
    const conditions: string[] = ["owner_id = $1"];
    const params: (string | number)[] = [user.userId];
    let paramIndex = 2;

    if (domainId) {
      conditions.push(`domain_id = $${paramIndex}`);
      params.push(domainId);
      paramIndex++;
    }

    if (conceptId) {
      // Search in both primary and supporting concept arrays
      conditions.push(
        `($${paramIndex} = ANY(concept_ids) OR $${paramIndex} = ANY(primary_concept_ids) OR $${paramIndex} = ANY(supporting_concept_ids))`
      );
      params.push(conceptId);
      paramIndex++;
    }

    if (difficulty) {
      conditions.push(`difficulty = $${paramIndex}`);
      params.push(difficulty);
      paramIndex++;
    }

    if (importance) {
      conditions.push(`importance = $${paramIndex}`);
      params.push(importance);
      paramIndex++;
    }

    if (tag) {
      conditions.push(`$${paramIndex} = ANY(tags)`);
      params.push(tag);
      paramIndex++;
    }

    if (search) {
      conditions.push(
        `(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    const result = await pool.query<DojoExerciseTemplateRow>(
      `SELECT * FROM dojo_exercise_templates WHERE ${whereClause} ORDER BY title`,
      params
    );

    const exercises = result.rows.map(exerciseTemplateToDomain);

    logger.info("api.dojo", "Listed exercises", {
      userId: user.userId,
      count: exercises.length,
      filters: { domainId, conceptId, difficulty, importance, tag, search },
    });

    return addCorsHeaders(
      NextResponse.json({ exercises, count: exercises.length }),
      req
    );
  } catch (error) {
    logger.error("api.dojo", "Failed to list exercises", { error });

    if (error instanceof Error && error.message === "Authentication required") {
      return addCorsHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        req
      );
    }

    return addCorsHeaders(
      NextResponse.json({ error: "Failed to list exercises" }, { status: 500 }),
      req
    );
  }
}

/**
 * POST /api/dojo/exercises
 * Create a new exercise template
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();

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

    // Generate IDs for subtasks
    const subtasksWithIds = data.subtasks.map((subtask, index) => ({
      ...subtask,
      id: generateSubtaskId(),
      label: subtask.label || `(${String.fromCharCode(97 + index)})`, // (a), (b), (c), ...
    }));

    // Create exercise object with branded IDs
    const exercise = {
      ...data,
      id,
      subtasks: subtasksWithIds,
      primaryConceptIds: (data.primaryConceptIds || []).map(asConceptNodeId),
      supportingConceptIds: (data.supportingConceptIds || []).map(
        asConceptNodeId
      ),
      variantIds: data.variantIds?.map(asExerciseVariantId),
      createdAt: now,
      updatedAt: now,
    };

    // Convert to DB row
    const row = exerciseTemplateToRow(exercise, user.userId);

    // Insert into database
    await pool.query(
      `INSERT INTO dojo_exercise_templates (
        id, owner_id, domain_id, title, description, problem_statement,
        concept_ids, primary_concept_ids, supporting_concept_ids,
        difficulty, importance, tags, subtasks_json,
        is_parameterized, parameter_schema, variant_generation_note,
        related_annotation_ids, related_document_ids, related_board_ids,
        source, author_notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
      [
        row.id,
        row.owner_id,
        row.domain_id,
        row.title,
        row.description,
        row.problem_statement,
        row.concept_ids,
        row.primary_concept_ids,
        row.supporting_concept_ids,
        row.difficulty,
        row.importance,
        row.tags,
        JSON.stringify(row.subtasks_json),
        row.is_parameterized,
        row.parameter_schema ? JSON.stringify(row.parameter_schema) : null,
        row.variant_generation_note,
        row.related_annotation_ids,
        row.related_document_ids,
        row.related_board_ids,
        row.source,
        row.author_notes,
        row.created_at,
        row.updated_at,
      ]
    );

    logger.info("api.dojo", "Created exercise", {
      userId: user.userId,
      exerciseId: id,
      title: exercise.title,
      domainId: exercise.domainId,
      subtaskCount: subtasksWithIds.length,
    });

    return addCorsHeaders(
      NextResponse.json({ exercise }, { status: 201 }),
      req
    );
  } catch (error) {
    logger.error("api.dojo", "Failed to create exercise", { error });

    if (error instanceof Error && error.message === "Authentication required") {
      return addCorsHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        req
      );
    }

    return addCorsHeaders(
      NextResponse.json(
        { error: "Failed to create exercise" },
        { status: 500 }
      ),
      req
    );
  }
}
