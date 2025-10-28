/**
 * Shared Postgres Connection Configuration
 * Reads from environment variables for consistent database connections
 */

import { Pool, PoolConfig } from "pg";

/**
 * Get Postgres configuration from environment variables
 */
export function getPostgresConfig(): PoolConfig {
  // Option 1: Use connection string (if provided)
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.POSTGRES_SSL === "require"
          ? { rejectUnauthorized: false }
          : false,
    };
  }

  // Option 2: Use individual environment variables
  return {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    database: process.env.POSTGRES_DB || "deeprecall",
    user: process.env.POSTGRES_USER || "deeprecall",
    password: process.env.POSTGRES_PASSWORD || "deeprecall",
    ssl:
      process.env.POSTGRES_SSL === "require"
        ? { rejectUnauthorized: false }
        : false,
  };
}

/**
 * Create a new Postgres pool with standard configuration
 */
export function createPostgresPool(overrides?: PoolConfig): Pool {
  const config = getPostgresConfig();
  return new Pool({ ...config, ...overrides });
}

/**
 * Execute a query with automatic pool cleanup
 */
export async function withPostgresPool<T>(
  callback: (pool: Pool) => Promise<T>
): Promise<T> {
  const pool = createPostgresPool();
  try {
    return await callback(pool);
  } finally {
    await pool.end();
  }
}
