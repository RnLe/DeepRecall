/**
 * Dojo Concept by ID API
 *
 * GET /api/dojo/concepts/[id] - Get a single concept
 * PUT /api/dojo/concepts/[id] - Update a concept
 * DELETE /api/dojo/concepts/[id] - Delete a concept
 */

import { NextRequest, NextResponse } from "next/server";
import { createPostgresPool } from "@/app/api/lib/postgres";
import { handleCorsOptions, addCorsHeaders } from "@/app/api/lib/cors";
import { requireAuth } from "@/app/api/lib/auth-helpers";
import { logger } from "@deeprecall/telemetry";
import { ConceptNodeUpdateSchema } from "@deeprecall/dojo-core";
import { conceptNodeToDomain } from "@deeprecall/dojo-data/mappers";
import type { DojoConceptNodeRow } from "@deeprecall/dojo-data/types";

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
 * GET /api/dojo/concepts/[id]
 * Get a single concept by ID
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    const result = await pool.query<DojoConceptNodeRow>(
      `SELECT * FROM dojo_concept_nodes WHERE id = $1 AND owner_id = $2`,
      [id, user.userId]
    );

    if (result.rows.length === 0) {
      return addCorsHeaders(
        NextResponse.json({ error: "Concept not found" }, { status: 404 }),
        req
      );
    }

    const concept = conceptNodeToDomain(result.rows[0]);

    logger.info("api.dojo", "Retrieved concept", {
      userId: user.userId,
      conceptId: id,
    });

    return addCorsHeaders(NextResponse.json({ concept }), req);
  } catch (error) {
    logger.error("api.dojo", "Failed to get concept", { error });

    if (error instanceof Error && error.message === "Authentication required") {
      return addCorsHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        req
      );
    }

    return addCorsHeaders(
      NextResponse.json({ error: "Failed to get concept" }, { status: 500 }),
      req
    );
  }
}

/**
 * PUT /api/dojo/concepts/[id]
 * Update a concept
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();

    // Validate input (with id added)
    const parseResult = ConceptNodeUpdateSchema.safeParse({ ...body, id });
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

    // Build dynamic update query
    const updates: string[] = ["updated_at = $2"];
    const values: (string | string[] | number | boolean | null)[] = [id, now];
    let paramIndex = 3;

    const fieldMappings: Record<string, string> = {
      domainId: "domain_id",
      name: "name",
      slug: "slug",
      description: "description",
      difficulty: "difficulty",
      importance: "importance",
      prerequisiteIds: "prerequisite_ids",
      tagIds: "tag_ids",
      relatedAnnotationIds: "related_annotation_ids",
      relatedDocumentIds: "related_document_ids",
      relatedBoardIds: "related_board_ids",
    };

    for (const [key, column] of Object.entries(fieldMappings)) {
      if (key in data && key !== "id") {
        updates.push(`${column} = $${paramIndex}`);
        values.push((data as Record<string, unknown>)[key] as string);
        paramIndex++;
      }
    }

    // Add owner_id filter
    values.push(user.userId);

    const result = await pool.query<DojoConceptNodeRow>(
      `UPDATE dojo_concept_nodes 
       SET ${updates.join(", ")} 
       WHERE id = $1 AND owner_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return addCorsHeaders(
        NextResponse.json({ error: "Concept not found" }, { status: 404 }),
        req
      );
    }

    const concept = conceptNodeToDomain(result.rows[0]);

    logger.info("api.dojo", "Updated concept", {
      userId: user.userId,
      conceptId: id,
    });

    return addCorsHeaders(NextResponse.json({ concept }), req);
  } catch (error) {
    logger.error("api.dojo", "Failed to update concept", { error });

    if (error instanceof Error && error.message === "Authentication required") {
      return addCorsHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        req
      );
    }

    return addCorsHeaders(
      NextResponse.json({ error: "Failed to update concept" }, { status: 500 }),
      req
    );
  }
}

/**
 * DELETE /api/dojo/concepts/[id]
 * Delete a concept
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;

    const result = await pool.query(
      `DELETE FROM dojo_concept_nodes WHERE id = $1 AND owner_id = $2 RETURNING id`,
      [id, user.userId]
    );

    if (result.rows.length === 0) {
      return addCorsHeaders(
        NextResponse.json({ error: "Concept not found" }, { status: 404 }),
        req
      );
    }

    logger.info("api.dojo", "Deleted concept", {
      userId: user.userId,
      conceptId: id,
    });

    return addCorsHeaders(NextResponse.json({ deleted: true, id }), req);
  } catch (error) {
    logger.error("api.dojo", "Failed to delete concept", { error });

    if (error instanceof Error && error.message === "Authentication required") {
      return addCorsHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        req
      );
    }

    // Check for foreign key constraint
    if (error instanceof Error && error.message.includes("foreign key")) {
      return addCorsHeaders(
        NextResponse.json(
          {
            error:
              "Cannot delete concept: it is referenced by exercises or other concepts",
          },
          { status: 409 }
        ),
        req
      );
    }

    return addCorsHeaders(
      NextResponse.json({ error: "Failed to delete concept" }, { status: 500 }),
      req
    );
  }
}
