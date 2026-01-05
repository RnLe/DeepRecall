/**
 * Dojo Concepts API
 *
 * GET /api/dojo/concepts - List all concepts (with optional filters)
 * POST /api/dojo/concepts - Create a new concept
 */

import { NextRequest, NextResponse } from "next/server";
import { createPostgresPool } from "@/app/api/lib/postgres";
import { handleCorsOptions, addCorsHeaders } from "@/app/api/lib/cors";
import { requireAuth } from "@/app/api/lib/auth-helpers";
import { logger } from "@deeprecall/telemetry";
import {
  ConceptNodeCreateSchema,
  asConceptNodeId,
  generateSlug,
} from "@deeprecall/dojo-core";
import {
  conceptNodeToDomain,
  conceptNodeToRow,
} from "@deeprecall/dojo-data/mappers";
import type { DojoConceptNodeRow } from "@deeprecall/dojo-data/types";

const pool = createPostgresPool();

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

/**
 * GET /api/dojo/concepts
 * List concepts with optional filtering
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const domainId = searchParams.get("domainId");
    const difficulty = searchParams.get("difficulty");
    const importance = searchParams.get("importance");
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

    if (search) {
      conditions.push(
        `(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    const result = await pool.query<DojoConceptNodeRow>(
      `SELECT * FROM dojo_concept_nodes WHERE ${whereClause} ORDER BY name`,
      params
    );

    const concepts = result.rows.map(conceptNodeToDomain);

    logger.info("api.dojo", "Listed concepts", {
      userId: user.userId,
      count: concepts.length,
      filters: { domainId, difficulty, importance, search },
    });

    return addCorsHeaders(
      NextResponse.json({ concepts, count: concepts.length }),
      req
    );
  } catch (error) {
    logger.error("api.dojo", "Failed to list concepts", { error });

    if (error instanceof Error && error.message === "Authentication required") {
      return addCorsHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        req
      );
    }

    return addCorsHeaders(
      NextResponse.json({ error: "Failed to list concepts" }, { status: 500 }),
      req
    );
  }
}

/**
 * POST /api/dojo/concepts
 * Create a new concept
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();

    // Validate input
    const parseResult = ConceptNodeCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return addCorsHeaders(
        NextResponse.json(
          { error: "Invalid concept data", details: parseResult.error.issues },
          { status: 400 }
        ),
        req
      );
    }

    const data = parseResult.data;
    const now = new Date().toISOString();
    const id = asConceptNodeId(crypto.randomUUID());

    // Generate slug if not provided
    const slug = data.slug || generateSlug(data.name);

    // Create concept object with branded IDs
    const concept = {
      ...data,
      id,
      slug,
      prerequisiteIds: (data.prerequisiteIds || []).map(asConceptNodeId),
      createdAt: now,
      updatedAt: now,
    };

    // Convert to DB row
    const row = conceptNodeToRow(concept, user.userId);

    // Insert into database
    await pool.query(
      `INSERT INTO dojo_concept_nodes (
        id, owner_id, domain_id, name, slug, description,
        difficulty, importance, prerequisite_ids, tag_ids,
        related_annotation_ids, related_document_ids, related_board_ids,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        row.id,
        row.owner_id,
        row.domain_id,
        row.name,
        row.slug,
        row.description,
        row.difficulty,
        row.importance,
        row.prerequisite_ids,
        row.tag_ids,
        row.related_annotation_ids,
        row.related_document_ids,
        row.related_board_ids,
        row.created_at,
        row.updated_at,
      ]
    );

    logger.info("api.dojo", "Created concept", {
      userId: user.userId,
      conceptId: id,
      name: concept.name,
      domainId: concept.domainId,
    });

    return addCorsHeaders(NextResponse.json({ concept }, { status: 201 }), req);
  } catch (error) {
    logger.error("api.dojo", "Failed to create concept", { error });

    if (error instanceof Error && error.message === "Authentication required") {
      return addCorsHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        req
      );
    }

    // Check for unique constraint violation (slug)
    if (error instanceof Error && error.message.includes("unique")) {
      return addCorsHeaders(
        NextResponse.json(
          { error: "A concept with this slug already exists" },
          { status: 409 }
        ),
        req
      );
    }

    return addCorsHeaders(
      NextResponse.json({ error: "Failed to create concept" }, { status: 500 }),
      req
    );
  }
}
