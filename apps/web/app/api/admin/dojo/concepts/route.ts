/**
 * Admin Dojo Concepts API
 *
 * GET /api/admin/dojo/concepts - List all global concepts
 * POST /api/admin/dojo/concepts - Create a new global concept
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
 * GET /api/admin/dojo/concepts
 * List all global concepts (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const domainId = searchParams.get("domainId");
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

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Bypass RLS by not setting app.user_id
    const result = await pool.query<
      DojoConceptNodeRow & { is_global: boolean }
    >(
      `SELECT *, is_global FROM dojo_concept_nodes ${whereClause} ORDER BY domain_id, name`,
      params
    );

    const concepts = result.rows.map((row) => ({
      ...conceptNodeToDomain(row),
      isGlobal: row.is_global,
      ownerId: row.owner_id,
    }));

    // Get domain summary
    const domainSummary = await pool.query<{
      domain_id: string;
      count: number;
    }>(
      `SELECT domain_id, COUNT(*) as count 
       FROM dojo_concept_nodes 
       WHERE is_global = true 
       GROUP BY domain_id 
       ORDER BY domain_id`
    );

    logger.info("api.dojo", "Listed global concepts", {
      count: concepts.length,
      domains: domainSummary.rows,
    });

    return addCorsHeaders(
      NextResponse.json({
        concepts,
        count: concepts.length,
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

    logger.error("api.dojo", "Failed to list concepts", { error });
    return addCorsHeaders(
      NextResponse.json({ error: "Failed to list concepts" }, { status: 500 }),
      req
    );
  }
}

/**
 * POST /api/admin/dojo/concepts
 * Create a new global concept
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    requireAdmin(req, body);

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
    const systemUserId = getSystemUserId();

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
    const row = conceptNodeToRow(concept, systemUserId);

    // Insert into database with is_global = true
    await pool.query(
      `INSERT INTO dojo_concept_nodes (
        id, owner_id, domain_id, name, slug, description,
        concept_kind, difficulty, importance, prerequisite_ids, tag_ids,
        related_annotation_ids, related_document_ids, related_board_ids,
        created_at, updated_at, is_global
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        row.id,
        row.owner_id,
        row.domain_id,
        row.name,
        row.slug,
        row.description,
        row.concept_kind,
        row.difficulty,
        row.importance,
        row.prerequisite_ids,
        row.tag_ids,
        row.related_annotation_ids,
        row.related_document_ids,
        row.related_board_ids,
        row.created_at,
        row.updated_at,
        true, // is_global
      ]
    );

    logger.info("api.dojo", "Created global concept", {
      conceptId: id,
      name: concept.name,
      domainId: concept.domainId,
    });

    return addCorsHeaders(
      NextResponse.json(
        { concept: { ...concept, isGlobal: true } },
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

    logger.error("api.dojo", "Failed to create concept", { error });

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
