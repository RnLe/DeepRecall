/**
 * Admin Dojo Overview API
 *
 * GET /api/admin/dojo/overview - Get global content statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { createPostgresPool } from "@/app/api/lib/postgres";
import { handleCorsOptions, addCorsHeaders } from "@/app/api/lib/cors";
import {
  requireAdmin,
  adminUnauthorizedResponse,
} from "@/app/api/lib/admin-auth";
import { logger } from "@deeprecall/telemetry";
import { DOMAIN_LABELS } from "@deeprecall/dojo-core";

const pool = createPostgresPool();

export interface DomainOverview {
  domainId: string;
  domainLabel: string;
  conceptCount: number;
  exerciseCount: number;
}

export interface GlobalContentStats {
  totalConcepts: number;
  totalExercises: number;
  domains: DomainOverview[];
  recentActivity: {
    conceptsLast7Days: number;
    exercisesLast7Days: number;
  };
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

/**
 * GET /api/admin/dojo/overview
 * Get overview statistics for global content
 */
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);

    // Get concept counts by domain
    const conceptsByDomain = await pool.query<{
      domain_id: string;
      count: string;
    }>(
      `SELECT domain_id, COUNT(*) as count 
       FROM dojo_concept_nodes 
       WHERE is_global = true 
       GROUP BY domain_id 
       ORDER BY domain_id`
    );

    // Get exercise counts by domain
    const exercisesByDomain = await pool.query<{
      domain_id: string;
      count: string;
    }>(
      `SELECT domain_id, COUNT(*) as count 
       FROM dojo_exercise_templates 
       WHERE is_global = true 
       GROUP BY domain_id 
       ORDER BY domain_id`
    );

    // Get totals
    const totalConcepts = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM dojo_concept_nodes WHERE is_global = true`
    );

    const totalExercises = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM dojo_exercise_templates WHERE is_global = true`
    );

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    const recentConcepts = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM dojo_concept_nodes 
       WHERE is_global = true AND created_at > $1`,
      [sevenDaysAgoISO]
    );

    const recentExercises = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM dojo_exercise_templates 
       WHERE is_global = true AND created_at > $1`,
      [sevenDaysAgoISO]
    );

    // Merge domain data
    const domainMap = new Map<string, DomainOverview>();

    // Get all unique domains
    const allDomains = new Set([
      ...conceptsByDomain.rows.map((r) => r.domain_id),
      ...exercisesByDomain.rows.map((r) => r.domain_id),
    ]);

    for (const domainId of allDomains) {
      domainMap.set(domainId, {
        domainId,
        domainLabel: DOMAIN_LABELS[domainId] || domainId,
        conceptCount: 0,
        exerciseCount: 0,
      });
    }

    for (const row of conceptsByDomain.rows) {
      const domain = domainMap.get(row.domain_id);
      if (domain) {
        domain.conceptCount = parseInt(row.count);
      }
    }

    for (const row of exercisesByDomain.rows) {
      const domain = domainMap.get(row.domain_id);
      if (domain) {
        domain.exerciseCount = parseInt(row.count);
      }
    }

    const stats: GlobalContentStats = {
      totalConcepts: parseInt(totalConcepts.rows[0]?.count || "0"),
      totalExercises: parseInt(totalExercises.rows[0]?.count || "0"),
      domains: Array.from(domainMap.values()).sort((a, b) =>
        a.domainLabel.localeCompare(b.domainLabel)
      ),
      recentActivity: {
        conceptsLast7Days: parseInt(recentConcepts.rows[0]?.count || "0"),
        exercisesLast7Days: parseInt(recentExercises.rows[0]?.count || "0"),
      },
    };

    logger.info("api.dojo", "Retrieved overview stats", {
      totalConcepts: stats.totalConcepts,
      totalExercises: stats.totalExercises,
      domainCount: stats.domains.length,
    });

    return addCorsHeaders(NextResponse.json(stats), req);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Admin authentication required"
    ) {
      return adminUnauthorizedResponse(req);
    }

    logger.error("api.dojo", "Failed to get overview", { error });
    return addCorsHeaders(
      NextResponse.json({ error: "Failed to get overview" }, { status: 500 }),
      req
    );
  }
}
