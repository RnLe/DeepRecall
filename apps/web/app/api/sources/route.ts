/**
 * Folder Sources API
 * GET  /api/sources        → list current user's sources
 * POST /api/sources        → register a new source
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  FolderSourceRegistrationSchema,
  FolderSourceStatusSchema,
  FolderSourceTypeSchema,
} from "@deeprecall/core";
import { requireAuth } from "@/app/api/lib/auth-helpers";
import { getPostgresPool } from "@/app/api/lib/postgres";
import { logger } from "@deeprecall/telemetry";
import { mapRowToFolderSource } from "./folder-source-helpers";

const CreateFolderSourceSchema = FolderSourceRegistrationSchema.extend({
  id: z.string().uuid().optional(),
  deviceId: z.string().min(1).optional(),
  status: FolderSourceStatusSchema.optional(),
});

const listQuerySchema = z.object({
  deviceId: z.string().optional(),
  type: FolderSourceTypeSchema.optional(),
  status: FolderSourceStatusSchema.optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const pool = getPostgresPool();

    const parsedQuery = listQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams.entries())
    );

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: parsedQuery.error.flatten() },
        { status: 400 }
      );
    }

    const filters = parsedQuery.data;
    const values: any[] = [user.userId];
    const clauses: string[] = ["owner_id = $1"];

    if (filters.deviceId) {
      values.push(filters.deviceId);
      clauses.push(`device_id = $${values.length}`);
    }

    if (filters.type) {
      values.push(filters.type);
      clauses.push(`type = $${values.length}`);
    }

    if (filters.status) {
      values.push(filters.status);
      clauses.push(`status = $${values.length}`);
    }

    const { rows } = await pool.query(
      `SELECT * FROM folder_sources WHERE ${clauses.join(" AND ")}
       ORDER BY priority DESC, updated_at DESC`,
      values
    );

    const sources = rows.map(mapRowToFolderSource);
    return NextResponse.json({ sources });
  } catch (error) {
    logger.error("server.api", "Failed to list folder sources", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to list sources" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const payload = await req.json();
    const parsed = CreateFolderSourceSchema.parse(payload);
    const deviceId = parsed.deviceId ?? user.deviceId;

    if (!deviceId) {
      return NextResponse.json(
        { error: "deviceId is required" },
        { status: 400 }
      );
    }

    const pool = getPostgresPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL app.user_id = $1", [user.userId]);

      if (parsed.isDefault) {
        await client.query(
          `UPDATE folder_sources SET is_default = false
           WHERE owner_id = $1 AND device_id = $2`,
          [user.userId, deviceId]
        );
      }

      const insert = await client.query(
        `INSERT INTO folder_sources (
           id, device_id, display_name, path, path_hash, uri,
           type, priority, is_default, status, metadata
         )
         VALUES (
           COALESCE($1::uuid, gen_random_uuid()),
           $2, $3, $4, $5, $6,
           $7, $8, COALESCE($9, false), COALESCE($10, 'idle'), $11::jsonb
         )
         RETURNING *`,
        [
          parsed.id ?? null,
          deviceId,
          parsed.displayName,
          parsed.path ?? null,
          parsed.pathHash ?? null,
          parsed.uri ?? null,
          parsed.type,
          parsed.priority ?? 50,
          parsed.isDefault ?? false,
          parsed.status ?? "idle",
          JSON.stringify(parsed.metadata ?? {}),
        ]
      );

      await client.query("COMMIT");
      const source = mapRowToFolderSource(insert.rows[0]);
      return NextResponse.json({ source }, { status: 201 });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error("server.api", "Failed to create folder source", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to create source" },
      { status: 500 }
    );
  }
}
