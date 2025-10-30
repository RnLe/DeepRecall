/**
 * Shared Postgres Connection Configuration
 * Reads from environment variables for consistent database connections
 */

import { Pool, PoolConfig } from "pg";

// Singleton pool instance (reused across API routes)
let globalPool: Pool | null = null;

/**
 * Get Postgres configuration from environment variables
 */
export function getPostgresConfig(): PoolConfig {
  // Option 1: Use connection string (if provided)
  if (process.env.DATABASE_URL) {
    const baseConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.POSTGRES_SSL === "require"
          ? { rejectUnauthorized: false }
          : false,
      // Add connection validation
      statement_timeout: 30000, // 30s query timeout
      query_timeout: 30000,
      connectionTimeoutMillis: 5000,
    };

    console.log("[PostgresConfig] Using DATABASE_URL connection");
    return baseConfig;
  }

  // Option 2: Use individual environment variables
  console.log("[PostgresConfig] Using individual env vars");
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
 * Get or create singleton Postgres pool
 * Reuses the same pool across all API routes to prevent connection exhaustion
 */
export function getPostgresPool(): Pool {
  if (!globalPool) {
    const config = getPostgresConfig();
    globalPool = new Pool({
      ...config,
      max: 20, // Reasonable limit
      idleTimeoutMillis: 10000, // Close idle connections quickly
      connectionTimeoutMillis: 5000, // Fail fast on timeout
    });

    // Handle pool-level errors (stale/dead connections)
    globalPool.on("error", (err, client) => {
      console.error("[PostgresPool] Idle client error, will be removed:", err);
      // Pool automatically removes and replaces bad connections
    });

    // Log connection stats in development
    if (process.env.NODE_ENV === "development") {
      globalPool.on("connect", (client) => {
        console.log(
          `[PostgresPool] ✓ Connected (total: ${globalPool?.totalCount}, idle: ${globalPool?.idleCount}, waiting: ${globalPool?.waitingCount})`
        );
      });
    }
  }
  return globalPool;
}

/**
 * Force reset the pool (for debugging connection issues)
 */
export async function resetPostgresPool(): Promise<void> {
  if (globalPool) {
    console.log("[PostgresPool] Resetting pool...");
    await globalPool.end();
    globalPool = null;
  }
}

/**
 * Create a new Postgres pool with standard configuration
 * @deprecated Use getPostgresPool() instead to reuse connections
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
