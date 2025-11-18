/**
 * Folder Sources detail API
 * GET    /api/sources/:sourceId
 * PATCH  /api/sources/:sourceId
 * DELETE /api/sources/:sourceId
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FolderSourceSchema, FolderSourceStatusSchema } from "@deeprecall/core";
import { requireAuth } from "@/app/api/lib/auth-helpers";
import { getPostgresPool } from "@/app/api/lib/postgres";
import { logger } from "@deeprecall/telemetry";
import { mapRowToFolderSource } from "../folder-source-helpers";

const SourceIdParamSchema = z.object({
  sourceId: z.string().uuid("sourceId must be a UUID"),
});

const UpdateFolderSourceSchema = z
  .object({
    displayName: z.string().min(1).optional(),
    path: z.string().nullable().optional(),
    pathHash: z.string().nullable().optional(),
    uri: z.string().url().nullable().optional(),
    priority: z.number().int().min(0).max(100).optional(),
    isDefault: z.boolean().optional(),
    status: FolderSourceStatusSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    lastScanStartedAt: z.string().datetime().optional(),
    lastScanCompletedAt: z.string().datetime().optional(),
    lastError: z.string().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const parsedParams = SourceIdParamSchema.parse(await params);

    const pool = getPostgresPool();
    const { rows } = await pool.query(
      `SELECT * FROM folder_sources WHERE id = $1 AND owner_id = $2`,
      [parsedParams.sourceId, user.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ source: mapRowToFolderSource(rows[0]) });
  } catch (error) {
    logger.error("server.api", "Failed to fetch folder source", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to load source" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const parsedParams = SourceIdParamSchema.parse(await params);
    const body = await req.json();
    const updates = UpdateFolderSourceSchema.parse(body);

    const pool = getPostgresPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL app.user_id = $1", [user.userId]);

      const existing = await client.query(
        `SELECT device_id FROM folder_sources WHERE id = $1 AND owner_id = $2`,
        [parsedParams.sourceId, user.userId]
      );

      if (existing.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const deviceId = existing.rows[0].device_id as string;

      if (updates.isDefault) {
        await client.query(
          `UPDATE folder_sources SET is_default = false
           WHERE owner_id = $1 AND device_id = $2 AND id <> $3`,
          [user.userId, deviceId, parsedParams.sourceId]
        );
      }

      const setClauses: string[] = [];
      const values: any[] = [];

      const pushUpdate = (clause: string, value: any) => {
        values.push(value);
        setClauses.push(`${clause} = $${values.length}`);
      };

      if (updates.displayName !== undefined) {
        pushUpdate("display_name", updates.displayName);
      }
      if (updates.path !== undefined) {
        pushUpdate("path", updates.path);
      }
      if (updates.pathHash !== undefined) {
        pushUpdate("path_hash", updates.pathHash);
      }
      if (updates.uri !== undefined) {
        pushUpdate("uri", updates.uri);
      }
      if (updates.priority !== undefined) {
        pushUpdate("priority", updates.priority);
      }
      if (updates.isDefault !== undefined) {
        pushUpdate("is_default", updates.isDefault);
      }
      if (updates.status !== undefined) {
        pushUpdate("status", updates.status);
      }
      if (updates.metadata !== undefined) {
        pushUpdate("metadata", JSON.stringify(updates.metadata));
        setClauses[setClauses.length - 1] =
          `metadata = $${values.length}::jsonb`;
      }
      if (updates.lastScanStartedAt !== undefined) {
        pushUpdate("last_scan_started_at", new Date(updates.lastScanStartedAt));
      }
      if (updates.lastScanCompletedAt !== undefined) {
        pushUpdate(
          "last_scan_completed_at",
          new Date(updates.lastScanCompletedAt)
        );
      }
      if (updates.lastError !== undefined) {
        pushUpdate("last_error", updates.lastError);
      }

      if (setClauses.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "No changes applied" },
          { status: 400 }
        );
      }

      const updateQuery = `
        UPDATE folder_sources
        SET ${setClauses.join(", ")}
        WHERE id = $${values.length + 1} AND owner_id = $${values.length + 2}
        RETURNING *`;

      const updateResult = await client.query(updateQuery, [
        ...values,
        parsedParams.sourceId,
        user.userId,
      ]);

      await client.query("COMMIT");

      if (updateResult.rows.length === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return NextResponse.json({
        source: mapRowToFolderSource(updateResult.rows[0]),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error("server.api", "Failed to update folder source", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to update source" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const parsedParams = SourceIdParamSchema.parse(await params);
    const pool = getPostgresPool();

    const result = await pool.query(
      `DELETE FROM folder_sources WHERE id = $1 AND owner_id = $2`,
      [parsedParams.sourceId, user.userId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error("server.api", "Failed to delete folder source", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to delete source" },
      { status: 500 }
    );
  }
}
