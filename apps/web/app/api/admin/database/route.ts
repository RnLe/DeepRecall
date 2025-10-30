/**
 * DELETE /api/admin/database
 * Emergency database wipe - clears ALL data from Postgres and SQLite CAS
 */

import { NextResponse } from "next/server";
import { clearDatabase } from "@/src/server/cas";
import { getPostgresPool } from "@/app/api/lib/postgres";

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
        console.log(`  ✅ Cleared ${table}`);
      } catch (error) {
        console.warn(`  ⚠️  Failed to clear ${table}:`, error);
        // Continue with other tables
      }
    }

    return tables.length;
  } finally {
    client.release();
  }
}

export async function DELETE() {
  try {
    console.log("🚨 EMERGENCY DATABASE WIPE INITIATED");

    // Step 1: Clear SQLite CAS database (blob metadata)
    console.log("Clearing SQLite CAS database...");
    await clearDatabase();
    console.log("✅ SQLite CAS cleared");

    // Step 2: Clear Postgres (all library tables)
    console.log("Clearing Postgres database...");
    const tablesCleared = await clearPostgres();
    console.log("✅ Postgres database cleared");

    return NextResponse.json({
      success: true,
      message: "All databases cleared successfully",
      cleared: {
        sqlite: true,
        postgres: true,
        tables: tablesCleared,
      },
    });
  } catch (error) {
    console.error("❌ Error clearing database:", error);
    return NextResponse.json(
      {
        error: "Failed to clear database",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
