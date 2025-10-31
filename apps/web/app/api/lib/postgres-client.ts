/**
 * Postgres Client Utilities with Retry Logic
 * Handles connection failures and retries for serverless Postgres (e.g., Neon)
 */

import { Pool, PoolClient } from "pg";
import { logger } from "@deeprecall/telemetry";

/**
 * Get a client from the pool with retry logic
 * Serverless Postgres (Neon) can timeout on cold starts
 */
export async function getClientWithRetry(
  pool: Pool,
  retries = 3,
  delay = 1000
): Promise<PoolClient> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.debug("db.postgres", "Attempting Postgres connection", {
        attempt,
        retries,
      });
      const client = await pool.connect();
      logger.info("db.postgres", "Postgres client connected", { attempt });
      return client;
    } catch (error) {
      lastError = error as Error;
      logger.error("db.postgres", "Postgres connection attempt failed", {
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });

      if (attempt < retries) {
        logger.debug("db.postgres", "Retrying Postgres connection", {
          delayMs: delay,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }

  throw new Error(
    `Failed to connect after ${retries} attempts: ${lastError?.message}`
  );
}

/**
 * Execute a query with automatic retry on connection failure
 */
export async function queryWithRetry<T = any>(
  pool: Pool,
  query: string,
  params?: any[]
): Promise<T> {
  const client = await getClientWithRetry(pool);

  try {
    const result = await client.query(query, params);
    return result.rows as T;
  } finally {
    client.release();
  }
}
