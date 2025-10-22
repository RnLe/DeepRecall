#!/usr/bin/env node
/**
 * Migration runner for PostgreSQL
 * Applies SQL migrations in order
 */

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://deeprecall:deeprecall@localhost:5432/deeprecall";
const MIGRATIONS_DIR = path.join(__dirname, "../migrations");

async function runMigrations() {
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

    // Get applied migrations
    const { rows: applied } = await client.query(
      "SELECT version FROM schema_migrations ORDER BY version"
    );
    const appliedVersions = new Set(applied.map((r) => r.version));

    // Read migration files
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    console.log(`Found ${files.length} migration files`);

    // Apply pending migrations
    for (const file of files) {
      const version = file.replace(".sql", "");

      if (appliedVersions.has(version)) {
        console.log(`⊘ ${version} (already applied)`);
        continue;
      }

      console.log(`→ Applying ${version}...`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [version]
        );
        await client.query("COMMIT");
        console.log(`✓ ${version} applied`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Failed to apply ${version}: ${error.message}`);
      }
    }

    console.log("✓ All migrations applied successfully");
  } catch (error) {
    console.error("✗ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
