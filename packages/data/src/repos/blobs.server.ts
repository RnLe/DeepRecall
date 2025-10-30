/**
 * Server-side blob coordination functions
 * Writes directly to Postgres (bypasses write buffer which requires IndexedDB)
 *
 * NOTE: These functions are meant to be used in Node.js/server environments.
 * For client-side operations, use the .writes.ts modules with the write buffer.
 */

import { Client } from "pg";

/**
 * Get a Postgres client connection
 * Uses DATABASE_URL from environment (required)
 */
async function getClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL environment variable is required for server-side Postgres operations. " +
        "Please set it in your .env file to connect to your Postgres/Neon database."
    );
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.POSTGRES_SSL === "require"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  await client.connect();
  return client;
}

export interface CreateBlobMetaInput {
  sha256: string;
  size: number;
  mime: string;
  filename?: string | null;
  pageCount?: number;
  imageWidth?: number;
  imageHeight?: number;
  lineCount?: number;
}

/**
 * Create blob metadata entry directly in Postgres (server-safe)
 */
export async function createBlobMetaServer(
  input: CreateBlobMetaInput
): Promise<void> {
  const client = await getClient();
  try {
    const now = Date.now();

    await client.query(
      `INSERT INTO blobs_meta (sha256, size, mime, filename, page_count, image_width, image_height, line_count, created_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (sha256) DO UPDATE SET
         size = EXCLUDED.size,
         mime = EXCLUDED.mime,
         filename = EXCLUDED.filename,
         page_count = EXCLUDED.page_count,
         image_width = EXCLUDED.image_width,
         image_height = EXCLUDED.image_height,
         line_count = EXCLUDED.line_count`,
      [
        input.sha256,
        input.size,
        input.mime,
        input.filename ?? null,
        input.pageCount ?? null,
        input.imageWidth ?? null,
        input.imageHeight ?? null,
        input.lineCount ?? null,
        now,
      ]
    );

    console.log(
      `[BlobsMetaServer] Created blob meta ${input.sha256.slice(0, 16)}... in Postgres`
    );
  } finally {
    await client.end();
  }
}

/**
 * Mark blob as available on a device directly in Postgres (server-safe)
 */
export async function markBlobAvailableServer(
  sha256: string,
  deviceId: string,
  localPath: string | null,
  health: "healthy" | "missing" | "modified" | "relocated" = "healthy"
): Promise<void> {
  const client = await getClient();
  try {
    const now = Date.now();
    const { randomUUID } = await import("crypto");
    const id = randomUUID();

    await client.query(
      `INSERT INTO device_blobs (id, device_id, sha256, present, local_path, health, mtime_ms, created_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (device_id, sha256) DO UPDATE SET
         present = EXCLUDED.present,
         local_path = EXCLUDED.local_path,
         health = EXCLUDED.health,
         mtime_ms = EXCLUDED.mtime_ms`,
      [id, deviceId, sha256, true, localPath, health, now, now]
    );

    console.log(
      `[DeviceBlobsServer] Marked blob ${sha256.slice(0, 16)}... available on device ${deviceId} in Postgres`
    );
  } finally {
    await client.end();
  }
}

/**
 * Update blob metadata directly in Postgres (server-safe)
 */
export async function updateBlobMetaServer(
  sha256: string,
  updates: {
    filename?: string | null;
    size?: number;
    mime?: string;
  }
): Promise<void> {
  const client = await getClient();
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.filename !== undefined) {
      setClauses.push(`filename = $${paramIndex++}`);
      values.push(updates.filename);
    }
    if (updates.size !== undefined) {
      setClauses.push(`size = $${paramIndex++}`);
      values.push(updates.size);
    }
    if (updates.mime !== undefined) {
      setClauses.push(`mime = $${paramIndex++}`);
      values.push(updates.mime);
    }

    if (setClauses.length > 0) {
      values.push(sha256);
      await client.query(
        `UPDATE blobs_meta SET ${setClauses.join(", ")} WHERE sha256 = $${paramIndex}`,
        values
      );

      console.log(
        `[BlobsMetaServer] Updated blob meta ${sha256.slice(0, 16)}... in Postgres`
      );
    }
  } finally {
    await client.end();
  }
}

/**
 * Delete blob metadata directly from Postgres (server-safe)
 */
export async function deleteBlobMetaServer(sha256: string): Promise<void> {
  const client = await getClient();
  try {
    await client.query(`DELETE FROM blobs_meta WHERE sha256 = $1`, [sha256]);

    console.log(
      `[BlobsMetaServer] Deleted blob meta ${sha256.slice(0, 16)}... from Postgres`
    );
  } finally {
    await client.end();
  }
}

/**
 * Delete device blob entry directly from Postgres (server-safe)
 */
export async function deleteDeviceBlobServer(
  sha256: string,
  deviceId: string
): Promise<void> {
  const client = await getClient();
  try {
    await client.query(
      `DELETE FROM device_blobs WHERE sha256 = $1 AND device_id = $2`,
      [sha256, deviceId]
    );

    console.log(
      `[DeviceBlobsServer] Deleted device blob ${sha256.slice(0, 16)}... from device ${deviceId} in Postgres`
    );
  } finally {
    await client.end();
  }
}
