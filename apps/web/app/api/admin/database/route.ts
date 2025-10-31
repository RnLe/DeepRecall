/**
 * DELETE /api/admin/database
 * Emergency database wipe - clears ALL data from Postgres and SQLite CAS
 */

import { NextRequest, NextResponse } from "next/server";
import { clearDatabase } from "@/src/server/cas";
import { getPostgresPool } from "@/app/api/lib/postgres";
import {
  handleCorsOptions,
  checkCorsOrigin,
  addCorsHeaders,
} from "@/app/api/lib/cors";
import { logger } from "@deeprecall/telemetry";

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

// Postgres connection for admin operations
async function clearPostgres() {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    // Clear all tables in reverse dependency order
    const tables = [
      "review_logs",
      "cards",
      "annotations",
      "edges",
      "assets",
      "works",
      "activities",
      "collections",
      "authors",
      "presets",
      "device_blobs",
      "blobs_meta",
      "replication_jobs",
    ];

    for (const table of tables) {
      try {
        await client.query(`TRUNCATE TABLE ${table} CASCADE;`);
        logger.info("db.postgres", "Cleared Postgres table", { table });
      } catch (error) {
        logger.warn("db.postgres", "Failed to clear Postgres table", {
          table,
          error: (error as Error).message,
        });
        // Continue with other tables
      }
    }

    return tables.length;
  } finally {
    client.release();
  }
}

export async function DELETE(request: NextRequest) {
  // Check CORS origin
  const corsError = checkCorsOrigin(request);
  if (corsError) return corsError;

  try {
    logger.warn("server.api", "EMERGENCY DATABASE WIPE INITIATED", {});

    // Step 1: Clear SQLite CAS database (blob metadata)
    await clearDatabase();
    logger.info("cas", "SQLite CAS database cleared", {});

    // Step 2: Clear Postgres (all library tables)
    const tablesCleared = await clearPostgres();
    logger.info("db.postgres", "Postgres database cleared", { tablesCleared });

    const response = NextResponse.json({
      success: true,
      message: "All databases cleared successfully",
      cleared: {
        sqlite: true,
        postgres: true,
        tables: tablesCleared,
      },
    });
    return addCorsHeaders(response, request);
  } catch (error) {
    logger.error("server.api", "Failed to clear database", {
      error: (error as Error).message,
    });
    const response = NextResponse.json(
      {
        error: "Failed to clear database",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
}
