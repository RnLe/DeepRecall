/**
 * Postgres Health Check API
 * GET /api/health/postgres
 *
 * Returns 200 if Postgres connection is healthy
 */

import { NextResponse } from "next/server";
import { createPostgresPool } from "@/app/api/lib/postgres";

export async function GET() {
  const pool = createPostgresPool({
    max: 1, // Only need one connection for health check
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 5000,
  });

  try {
    // Simple query to verify connection
    const result = await pool.query("SELECT 1 as healthy");

    if (result.rows[0]?.healthy === 1) {
      return NextResponse.json({ status: "ok", connected: true });
    } else {
      return NextResponse.json(
        { status: "error", message: "Unexpected query result" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[PostgresHealth] Connection failed:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Connection failed",
      },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
