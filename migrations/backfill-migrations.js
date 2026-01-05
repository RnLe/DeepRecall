#!/usr/bin/env node
/**
 * One-time script to backfill schema_migrations table
 * Marks all existing migrations as applied (for databases that already have the schema)
 */

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const DATABASE_URL = process.env.DATABASE_URL;
const MIGRATIONS_DIR = __dirname;

async function backfillMigrations() {
  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL not set");
    process.exit(1);
  }

  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log("✓ Connected to PostgreSQL");

    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Read all migration files
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    // Get latest migration file (010_dojo_schema.sql)
    const latestMigration = files[files.length - 1].replace(".sql", "");

    // Mark all migrations EXCEPT the latest as already applied
    for (const file of files) {
      const version = file.replace(".sql", "");

      // Skip the latest - we want to actually run that one
      if (version === latestMigration) {
        console.log(`⏭ ${version} (will be applied next)`);
        continue;
      }

      await client.query(
        `INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING`,
        [version]
      );
      console.log(`✓ ${version} marked as applied`);
    }

    console.log(
      "\n✓ Backfill complete! Now run 'make pg-update' to apply the latest migration."
    );
  } catch (error) {
    console.error("✗ Backfill failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

backfillMigrations();
