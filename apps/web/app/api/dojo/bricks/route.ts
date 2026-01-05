/**
 * Dojo Bricks API
 *
 * GET /api/dojo/bricks - List all brick states (concept and exercise)
 * POST /api/dojo/bricks/compute - Compute and update brick states after attempts
 */

import { NextRequest, NextResponse } from "next/server";
import { createPostgresPool } from "@/app/api/lib/postgres";
import { handleCorsOptions, addCorsHeaders } from "@/app/api/lib/cors";
import { requireAuth } from "@/app/api/lib/auth-helpers";
import { logger } from "@deeprecall/telemetry";
import {
  conceptBrickToDomain,
  exerciseBrickToDomain,
} from "@deeprecall/dojo-data/mappers";
import type {
  DojoConceptBrickRow,
  DojoExerciseBrickRow,
} from "@deeprecall/dojo-data/types";

const pool = createPostgresPool();

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

/**
 * GET /api/dojo/bricks
 * List all brick states for the user
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const type = searchParams.get("type"); // "concept" | "exercise" | null (both)
    const domainId = searchParams.get("domainId");

    const response: {
      conceptBricks?: ReturnType<typeof conceptBrickToDomain>[];
      exerciseBricks?: ReturnType<typeof exerciseBrickToDomain>[];
    } = {};

    // Get concept bricks
    if (!type || type === "concept") {
      let conceptQuery = `
        SELECT cb.* FROM dojo_concept_bricks cb
        WHERE cb.owner_id = $1
      `;
      const conceptParams: string[] = [user.userId];

      if (domainId) {
        conceptQuery = `
          SELECT cb.* FROM dojo_concept_bricks cb
          JOIN dojo_concept_nodes cn ON cn.id = cb.concept_id
          WHERE cb.owner_id = $1 AND cn.domain_id = $2
        `;
        conceptParams.push(domainId);
      }

      const conceptResult = await pool.query<DojoConceptBrickRow>(
        conceptQuery,
        conceptParams
      );

      response.conceptBricks = conceptResult.rows.map(conceptBrickToDomain);
    }

    // Get exercise bricks
    if (!type || type === "exercise") {
      let exerciseQuery = `
        SELECT eb.* FROM dojo_exercise_bricks eb
        WHERE eb.owner_id = $1
      `;
      const exerciseParams: string[] = [user.userId];

      if (domainId) {
        exerciseQuery = `
          SELECT eb.* FROM dojo_exercise_bricks eb
          JOIN dojo_exercise_templates et ON et.id = eb.template_id
          WHERE eb.owner_id = $1 AND et.domain_id = $2
        `;
        exerciseParams.push(domainId);
      }

      const exerciseResult = await pool.query<DojoExerciseBrickRow>(
        exerciseQuery,
        exerciseParams
      );

      response.exerciseBricks = exerciseResult.rows.map(exerciseBrickToDomain);
    }

    logger.info("api.dojo", "Listed bricks", {
      userId: user.userId,
      conceptCount: response.conceptBricks?.length ?? 0,
      exerciseCount: response.exerciseBricks?.length ?? 0,
      filters: { type, domainId },
    });

    return addCorsHeaders(NextResponse.json(response), req);
  } catch (error) {
    logger.error("api.dojo", "Failed to list bricks", { error });

    if (error instanceof Error && error.message === "Authentication required") {
      return addCorsHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        req
      );
    }

    return addCorsHeaders(
      NextResponse.json({ error: "Failed to list bricks" }, { status: 500 }),
      req
    );
  }
}
