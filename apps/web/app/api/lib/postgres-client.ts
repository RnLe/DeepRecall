/**
 * Postgres Client Utilities with Retry Logic
 * Handles connection failures and retries for serverless Postgres (e.g., Neon)
 */

import { Pool, PoolClient } from "pg";

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
      console.log(
        `[PostgresClient] Attempting connection (${attempt}/${retries})...`
      );
      const client = await pool.connect();
      console.log(`[PostgresClient] ✓ Connected on attempt ${attempt}`);
      return client;
    } catch (error) {
      lastError = error as Error;
      console.error(
        `[PostgresClient] Connection attempt ${attempt} failed:`,
        error instanceof Error ? error.message : error
      );

      if (attempt < retries) {
        console.log(`[PostgresClient] Retrying in ${delay}ms...`);
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
