/**
 * Postgres Health Check API
 * GET /api/health/postgres
 *
 * Returns 200 if Postgres connection is healthy
 */

import { NextResponse } from "next/server";
import { getPostgresPool } from "@/app/api/lib/postgres";

export async function GET() {
  const pool = getPostgresPool();
  let client;

  // Retry logic for serverless Postgres (Neon can have cold starts)
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Get client from pool
      client = await pool.connect();

      // Simple query to verify connection
      const result = await client.query("SELECT 1 as healthy");

      if (result.rows[0]?.healthy === 1) {
        return NextResponse.json({ status: "ok", connected: true });
      } else {
        return NextResponse.json(
          { status: "error", message: "Unexpected query result" },
          { status: 500 }
        );
      }
    } catch (error) {
      lastError = error as Error;
      console.error(
        `[PostgresHealth] Connection attempt ${attempt}/${maxRetries} failed:`,
        error
      );

      // Clean up failed connection
      if (client) {
        try {
          client.release();
        } catch {}
        client = undefined;
      }

      // Don't retry on last attempt
      if (attempt < maxRetries) {
        console.log("[PostgresHealth] Retrying...");
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // All retries failed
  return NextResponse.json(
    {
      status: "error",
      message: lastError?.message || "Connection failed",
    },
    { status: 500 }
  );
}
