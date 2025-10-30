/**
 * GET /api/admin/postgres/all
 * Fetch all tables in a single request (efficient!)
 */

import { NextResponse } from "next/server";
import { getPostgresPool } from "@/app/api/lib/postgres";

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

export async function GET() {
  const pool = getPostgresPool();
  let client;

  try {
    client = await pool.connect();

    // Fetch all tables in parallel using a single connection
    const results: Record<string, any[]> = {};

    for (const tableName of VALID_TABLES) {
      try {
        const result = await client.query(
          `SELECT * FROM ${tableName} LIMIT 1000`
        );
        results[tableName] = result.rows;
      } catch (error) {
        console.error(`Error fetching ${tableName}:`, error);
        results[tableName] = [];
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching all Postgres data:", error);
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
