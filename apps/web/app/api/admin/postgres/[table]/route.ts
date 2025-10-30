import { NextRequest, NextResponse } from "next/server";
import { getPostgresPool } from "@/app/api/lib/postgres";
import { getClientWithRetry } from "@/app/api/lib/postgres-client";

// Valid Postgres table names
const VALID_TABLES = [
  "works",
  "assets",
  "activities",
  "collections",
  "edges",
  "presets",
  "authors",
  "annotations",
  "cards",
  "review_logs",
  "blobs_meta",
  "device_blobs",
  "boards",
  "strokes",
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const pool = getPostgresPool();
  let client;

  try {
    const { table: tableName } = await params;

    // Validate table name (prevent SQL injection)
    if (!VALID_TABLES.includes(tableName as any)) {
      return NextResponse.json(
        { error: `Invalid table: ${tableName}` },
        { status: 400 }
      );
    }

    // Get connection from pool with error handling
    try {
      client = await pool.connect();
    } catch (poolError) {
      console.error(
        `[PostgresAdmin] Pool connection timeout for ${tableName}:`,
        poolError
      );
      return NextResponse.json(
        {
          error: "Database connection pool exhausted",
          details: "Too many concurrent requests. Please try again.",
        },
        { status: 503 }
      );
    }

    // Fetch all records using raw SQL (limit to reasonable amount for safety)
    // Using template string is safe here because we validated tableName against whitelist
    const result = await client.query(`SELECT * FROM ${tableName} LIMIT 1000`);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching Postgres data:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}
