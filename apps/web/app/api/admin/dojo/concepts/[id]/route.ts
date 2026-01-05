/**
 * Admin Dojo Concept by ID API
 *
 * GET /api/admin/dojo/concepts/[id] - Get a specific concept
 * PUT /api/admin/dojo/concepts/[id] - Update a concept
 * DELETE /api/admin/dojo/concepts/[id] - Delete a concept
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
  ConceptNodeUpdateSchema,
  asConceptNodeId,
  generateSlug,
} from "@deeprecall/dojo-core";
import { conceptNodeToDomain } from "@deeprecall/dojo-data/mappers";
import type { DojoConceptNodeRow } from "@deeprecall/dojo-data/types";

const pool = createPostgresPool();

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

/**
 * GET /api/admin/dojo/concepts/[id]
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    requireAdmin(req);
    const { id } = await params;

    const result = await pool.query<
      DojoConceptNodeRow & { is_global: boolean }
    >(`SELECT *, is_global FROM dojo_concept_nodes WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return addCorsHeaders(
        NextResponse.json({ error: "Concept not found" }, { status: 404 }),
        req
      );
    }

    const row = result.rows[0];
    const concept = {
      ...conceptNodeToDomain(row),
      isGlobal: row.is_global,
      ownerId: row.owner_id,
    };

    return addCorsHeaders(NextResponse.json({ concept }), req);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Admin authentication required"
    ) {
      return adminUnauthorizedResponse(req);
    }

    logger.error("api.dojo", "Failed to get concept", { error });
    return addCorsHeaders(
      NextResponse.json({ error: "Failed to get concept" }, { status: 500 }),
      req
    );
  }
}

/**
 * PUT /api/admin/dojo/concepts/[id]
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const body = await req.json();
    requireAdmin(req, body);
    const { id } = await params;

    // First check if concept exists and is global
    const existing = await pool.query<{ is_global: boolean }>(
      `SELECT is_global FROM dojo_concept_nodes WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return addCorsHeaders(
        NextResponse.json({ error: "Concept not found" }, { status: 404 }),
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

    const updates = parseResult.data;
    const now = new Date().toISOString();

    // Build dynamic UPDATE query
    const setClauses: string[] = ["updated_at = $2"];
    const queryParams: unknown[] = [id, now];
    let paramIndex = 3;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      queryParams.push(updates.name);
      paramIndex++;
    }

    if (updates.slug !== undefined) {
      setClauses.push(`slug = $${paramIndex}`);
      queryParams.push(updates.slug);
      paramIndex++;
    } else if (updates.name !== undefined) {
      // Auto-generate slug from name
      setClauses.push(`slug = $${paramIndex}`);
      queryParams.push(generateSlug(updates.name));
      paramIndex++;
    }

    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      queryParams.push(updates.description);
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

    if (updates.prerequisiteIds !== undefined) {
      setClauses.push(`prerequisite_ids = $${paramIndex}`);
      queryParams.push(updates.prerequisiteIds);
      paramIndex++;
    }

    if (updates.tagIds !== undefined) {
      setClauses.push(`tag_ids = $${paramIndex}`);
      queryParams.push(updates.tagIds);
      paramIndex++;
    }

    const result = await pool.query<
      DojoConceptNodeRow & { is_global: boolean }
    >(
      `UPDATE dojo_concept_nodes 
       SET ${setClauses.join(", ")} 
       WHERE id = $1 
       RETURNING *, is_global`,
      queryParams
    );

    const row = result.rows[0];
    const concept = {
      ...conceptNodeToDomain(row),
      isGlobal: row.is_global,
      ownerId: row.owner_id,
    };

    logger.info("api.dojo", "Updated concept", {
      conceptId: id,
      updates: Object.keys(updates),
    });

    return addCorsHeaders(NextResponse.json({ concept }), req);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Admin authentication required"
    ) {
      return adminUnauthorizedResponse(req);
    }

    logger.error("api.dojo", "Failed to update concept", { error });
    return addCorsHeaders(
      NextResponse.json({ error: "Failed to update concept" }, { status: 500 }),
      req
    );
  }
}

/**
 * DELETE /api/admin/dojo/concepts/[id]
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    requireAdmin(req);
    const { id } = await params;

    // First check if concept exists and is global
    const existing = await pool.query<{ is_global: boolean; name: string }>(
      `SELECT is_global, name FROM dojo_concept_nodes WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return addCorsHeaders(
        NextResponse.json({ error: "Concept not found" }, { status: 404 }),
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

    // Check for dependent exercises
    const dependents = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM dojo_exercise_templates WHERE $1 = ANY(concept_ids)`,
      [id]
    );

    if (parseInt(dependents.rows[0].count) > 0) {
      return addCorsHeaders(
        NextResponse.json(
          {
            error: "Cannot delete concept with dependent exercises",
            dependentCount: parseInt(dependents.rows[0].count),
          },
          { status: 409 }
        ),
        req
      );
    }

    // Check for concepts that have this as prerequisite
    const prerequisites = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM dojo_concept_nodes WHERE $1 = ANY(prerequisite_ids)`,
      [id]
    );

    if (parseInt(prerequisites.rows[0].count) > 0) {
      return addCorsHeaders(
        NextResponse.json(
          {
            error:
              "Cannot delete concept that is a prerequisite of other concepts",
            dependentCount: parseInt(prerequisites.rows[0].count),
          },
          { status: 409 }
        ),
        req
      );
    }

    await pool.query(`DELETE FROM dojo_concept_nodes WHERE id = $1`, [id]);

    logger.info("api.dojo", "Deleted concept", {
      conceptId: id,
      name: existing.rows[0].name,
    });

    return addCorsHeaders(
      NextResponse.json({ success: true, deleted: id }),
      req
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Admin authentication required"
    ) {
      return adminUnauthorizedResponse(req);
    }

    logger.error("api.dojo", "Failed to delete concept", { error });
    return addCorsHeaders(
      NextResponse.json({ error: "Failed to delete concept" }, { status: 500 }),
      req
    );
  }
}
