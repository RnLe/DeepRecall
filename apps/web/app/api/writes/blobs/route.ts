/**
 * POST /api/writes/blobs
 * Server-side route to create blob coordination entries in Electric
 *
 * This is called by storeBlob() to create blobs_meta and device_blobs
 * entries after successfully storing a blob in the local CAS.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@deeprecall/telemetry";
import { requireAuth } from "@/app/api/lib/auth-helpers";
import { getPostgresPool } from "@/app/api/lib/postgres";

const BlobCoordinationSchema = z.object({
  sha256: z.string().min(64).max(64),
  size: z.number().int().min(0),
  mime: z.string(),
  filename: z.string().nullable(),
  deviceId: z.string(),
  localPath: z.string().nullable().optional(),

  // Optional extracted metadata
  pageCount: z.number().int().optional(),
  imageWidth: z.number().int().optional(),
  imageHeight: z.number().int().optional(),
  lineCount: z.number().int().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    let userContext;
    try {
      userContext = await requireAuth(request);
    } catch (error) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data = BlobCoordinationSchema.parse(body);

    // Use direct Postgres connection with RLS context
    const pool = getPostgresPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Set user context for RLS
      await client.query("SET LOCAL app.user_id = $1", [userContext.userId]);

      // Create blobs_meta entry
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
          data.sha256,
          data.size,
          data.mime,
          data.filename ?? null,
          data.pageCount ?? null,
          data.imageWidth ?? null,
          data.imageHeight ?? null,
          data.lineCount ?? null,
          now,
        ]
      );

      // Mark blob as available on this device
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
        [
          id,
          data.deviceId,
          data.sha256,
          true,
          data.localPath || null,
          "healthy",
          now,
          now,
        ]
      );

      await client.query("COMMIT");

      logger.info("sync.coordination", "Blob coordination entries created", {
        sha256: data.sha256.slice(0, 16),
        deviceId: data.deviceId,
        filename: data.filename,
        userId: userContext.userId,
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error(
      "sync.coordination",
      "Failed to create blob coordination entries",
      {
        error: (error as Error).message,
      }
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create blob coordination",
      },
      { status: 500 }
    );
  }
}
