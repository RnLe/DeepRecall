/**
 * Write Batch API
 * POST /api/writes/batch
 *
 * Accepts batched write changes from clients and applies them to Postgres
 * with conflict resolution (last-write-wins by updated_at)
 */

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { z } from "zod";
import {
  WorkSchema,
  AssetSchema,
  ActivitySchema,
  CollectionSchema,
  EdgeSchema,
  PresetSchema,
  AuthorSchema,
  AnnotationSchema,
  CardSchema,
  ReviewLogSchema,
} from "@deeprecall/core";

/**
 * Write change schema
 */
const WriteChangeSchema = z.object({
  id: z.string().uuid(),
  table: z.enum([
    "works",
    "assets",
    "activities",
    "collections",
    "edges",
    "presets",
    "authors",
    "annotations",
    "cards",
    "review_logs",
  ]),
  op: z.enum(["insert", "update", "delete"]),
  payload: z.any(), // Will be validated by specific table schema
  created_at: z.number(),
  status: z.enum(["pending", "syncing", "applied", "error"]),
  retry_count: z.number(),
});

type WriteChange = z.infer<typeof WriteChangeSchema>;

/**
 * Batch request schema
 */
const BatchRequestSchema = z.object({
  changes: z.array(WriteChangeSchema),
});

/**
 * Get schema for table
 */
function getSchemaForTable(table: string): z.ZodTypeAny {
  switch (table) {
    case "works":
      return WorkSchema;
    case "assets":
      return AssetSchema;
    case "activities":
      return ActivitySchema;
    case "collections":
      return CollectionSchema;
    case "edges":
      return EdgeSchema;
    case "presets":
      return PresetSchema;
    case "authors":
      return AuthorSchema;
    case "annotations":
      return AnnotationSchema;
    case "cards":
      return CardSchema;
    case "review_logs":
      return ReviewLogSchema;
    default:
      throw new Error(`Unknown table: ${table}`);
  }
}

/**
 * Convert camelCase to snake_case for Postgres columns
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * JSONB columns that need JSON stringification
 * These columns store complex objects/arrays as JSONB in Postgres
 */
const JSONB_COLUMNS = new Set([
  "core_field_config",
  "custom_fields",
  "metadata",
  "authors", // legacy field
  "geometry",
  "style",
  "avatar_crop_region",
]);

/**
 * Convert object keys to snake_case and prepare values for Postgres
 */
function keysToSnakeCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);

    // Handle JSONB columns - serialize objects/arrays to JSON strings
    if (JSONB_COLUMNS.has(snakeKey) && value !== null && value !== undefined) {
      if (typeof value === "object") {
        result[snakeKey] = JSON.stringify(value);
      } else {
        result[snakeKey] = value;
      }
    } else {
      // Pass through as-is (handles primitives, TEXT[], etc.)
      result[snakeKey] = value;
    }
  }
  return result;
}

/**
 * Apply insert operation
 */
async function applyInsert(pool: Pool, change: WriteChange): Promise<any> {
  const schema = getSchemaForTable(change.table);
  const validated = schema.parse(change.payload);
  const data = keysToSnakeCase(validated as Record<string, any>);

  // Build INSERT query
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

  const query = `
    INSERT INTO ${change.table} (${columns.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET
      ${columns.map((col, i) => `${col} = $${i + 1}`).join(", ")}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Apply update operation with LWW conflict resolution
 */
async function applyUpdate(pool: Pool, change: WriteChange): Promise<any> {
  const schema = getSchemaForTable(change.table);
  const validated = schema.parse(change.payload);
  const data = keysToSnakeCase(validated as Record<string, any>);

  // Check if record exists and compare timestamps
  const existing = await pool.query(
    `SELECT updated_at FROM ${change.table} WHERE id = $1`,
    [data.id]
  );

  if (existing.rows.length === 0) {
    // Record doesn't exist, treat as insert
    return applyInsert(pool, change);
  }

  // Last-write-wins: only update if client's timestamp >= server's timestamp
  const serverUpdatedAt = existing.rows[0].updated_at;
  const clientUpdatedAt = data.updated_at;

  if (clientUpdatedAt < serverUpdatedAt) {
    console.log(
      `[WritesBatch] Skipping update for ${change.table}/${data.id} - server is newer (server: ${serverUpdatedAt}, client: ${clientUpdatedAt})`
    );
    // Return existing record
    const result = await pool.query(
      `SELECT * FROM ${change.table} WHERE id = $1`,
      [data.id]
    );
    return result.rows[0];
  }

  // Build UPDATE query
  const columns = Object.keys(data).filter((col) => col !== "id");
  const values = columns.map((col) => data[col]);
  const setClause = columns.map((col, i) => `${col} = $${i + 2}`).join(", ");

  const query = `
    UPDATE ${change.table}
    SET ${setClause}
    WHERE id = $1
    RETURNING *
  `;

  const result = await pool.query(query, [data.id, ...values]);
  return result.rows[0];
}

/**
 * Apply delete operation (with tombstone support)
 */
async function applyDelete(pool: Pool, change: WriteChange): Promise<any> {
  const { id } = change.payload;

  // For now, hard delete
  // TODO: Add tombstone support for soft deletes
  const query = `
    DELETE FROM ${change.table}
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || { id, deleted: true };
}

/**
 * Apply a single write change
 */
async function applyChange(
  pool: Pool,
  change: WriteChange
): Promise<{ success: boolean; response?: any; error?: string }> {
  try {
    let response;

    switch (change.op) {
      case "insert":
        response = await applyInsert(pool, change);
        break;
      case "update":
        response = await applyUpdate(pool, change);
        break;
      case "delete":
        response = await applyDelete(pool, change);
        break;
      default:
        throw new Error(`Unknown operation: ${change.op}`);
    }

    return { success: true, response };
  } catch (error) {
    console.error(`[WritesBatch] Error applying change ${change.id}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * POST handler
 */
export async function POST(request: NextRequest) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Parse and validate request body
    const body = await request.json();
    const { changes } = BatchRequestSchema.parse(body);

    console.log(`[WritesBatch] Processing ${changes.length} changes`);

    // Apply changes in transaction
    const client = await pool.connect();
    const results: any[] = [];
    const appliedIds: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    try {
      await client.query("BEGIN");

      for (const change of changes) {
        const result = await applyChange(pool, change);

        if (result.success) {
          results.push(result.response);
          appliedIds.push(change.id);
        } else {
          errors.push({
            id: change.id,
            error: result.error || "Unknown error",
          });
        }
      }

      await client.query("COMMIT");
      console.log(
        `[WritesBatch] Successfully applied ${appliedIds.length}/${changes.length} changes`
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    // Return results
    return NextResponse.json({
      success: true,
      applied: appliedIds,
      responses: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[WritesBatch] Batch processing failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
