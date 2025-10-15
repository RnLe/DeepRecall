/**
 * SQLite database instance (server-side only)
 * Uses better-sqlite3 for synchronous, fast access
 *
 * IMPORTANT: All imports and initialization are lazy to avoid loading
 * the native module during Edge runtime instrumentation.
 */

import type Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

// Lazy initialization to prevent native module loading during Edge instrumentation
let _db: BetterSQLite3Database<typeof schema> | null = null;
let _sqlite: Database.Database | null = null;

/**
 * Get or create the database instance
 * Only call this from Node.js runtime (API routes, server components)
 * Automatically runs migrations on first access
 */
export function getDB(): BetterSQLite3Database<typeof schema> {
  if (_db) return _db;

  console.log("Initializing SQLite database...");

  // Lazy import of native module
  const Database = require("better-sqlite3");
  const { drizzle } = require("drizzle-orm/better-sqlite3");
  const { migrate } = require("drizzle-orm/better-sqlite3/migrator");

  // Database file location (persisted in Docker volume)
  const DB_PATH =
    process.env.DB_PATH || path.join(process.cwd(), "data", "cas.db");

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Initialize SQLite
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL"); // Write-Ahead Logging for better concurrency
  _sqlite = sqlite;

  // Wrap with Drizzle
  const drizzleDb = drizzle(sqlite, { schema });
  _db = drizzleDb;

  // Run migrations automatically on first access
  try {
    migrate(drizzleDb, {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    console.log("Database initialized and migrated");
  } catch (error) {
    console.error("Database migration failed:", error);
    // Don't throw - let the app start, migrations might already be applied
  }

  return drizzleDb;
}

// For backward compatibility, export db but make it a getter
export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop) {
    return getDB()[prop as keyof BetterSQLite3Database<typeof schema>];
  },
});

/**
 * Initialize/migrate database schema
 * Call this once at server startup
 */
export function initDB() {
  try {
    // Lazy import of migrate function
    const { migrate } = require("drizzle-orm/better-sqlite3/migrator");

    // Get DB instance (triggers lazy initialization)
    const dbInstance = getDB();

    // Run migrations from drizzle/migrations folder
    migrate(dbInstance, {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    console.log("Database initialized");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}

/**
 * Close database connection (for graceful shutdown)
 */
export function closeDB() {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
  }
}
