/**
 * Write Batch API
 * POST /api/writes/batch
 *
 * Accepts batched write changes from clients and applies them to Postgres
 * with conflict resolution (last-write-wins by updated_at)
 */

import { NextRequest, NextResponse } from "next/server";
import { Pool, PoolClient } from "pg";
import { createPostgresPool } from "@/app/api/lib/postgres";
import {
  handleCorsOptions,
  checkCorsOrigin,
  addCorsHeaders,
} from "@/app/api/lib/cors";
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
  BoardSchema,
  StrokeSchema,
  BlobMetaSchema,
  DeviceBlobSchema,
} from "@deeprecall/core";

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

/**
 * Write change schema
 */
const WriteChangeSchema = z.object({
  id: z.string().min(1), // Accept any non-empty string ID (UUIDs from uuid library may have different formats)
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
    "boards",
    "strokes",
    "blobs_meta",
    "device_blobs",
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
    case "boards":
      return BoardSchema;
    case "strokes":
      return StrokeSchema;
    case "blobs_meta":
      return BlobMetaSchema;
    case "device_blobs":
      return DeviceBlobSchema;
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
  "points", // strokes points array
  "bounding_box", // strokes bounding box
]);

/**
 * Convert object keys to snake_case and prepare values for Postgres
 */
/**
 * Convert ISO date fields to epoch milliseconds for blob tables
 * TypeScript schemas use ISO dates, but Postgres blob tables use BIGINT epoch ms
 */
function transformBlobData(
  table: string,
  obj: Record<string, any>
): Record<string, any> {
  if (table !== "blobs_meta" && table !== "device_blobs") {
    return obj;
  }

  const result = { ...obj };

  // Convert createdAt (ISO) → created_ms (epoch)
  if (result.createdAt) {
    result.created_ms = new Date(result.createdAt).getTime();
    delete result.createdAt;
  }

  // Remove updatedAt - device_blobs table doesn't have this column
  if (table === "device_blobs" && result.updatedAt) {
    delete result.updatedAt;
  }

  return result;
}

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
 * Transform annotation data from client schema to Postgres schema
 * Client: { data: { type, rects/ranges }, metadata: {...} }
 * Postgres: { type, geometry, style, content, metadata, attached_assets }
 *
 * Handles both full and partial updates
 */
function transformAnnotationData(validated: any): Record<string, any> {
  const { data, metadata, ...rest } = validated;

  const result: Record<string, any> = { ...rest };

  // Only transform data fields if data is present (might be missing in partial updates)
  if (data) {
    result.kind = "annotation"; // Postgres has a kind column that must be 'annotation'
    result.type = data.type;

    // Build geometry JSONB (contains rects or ranges)
    result.geometry =
      data.type === "rectangle"
        ? { rects: data.rects }
        : { ranges: data.ranges };
  }

  // Only transform metadata fields if metadata is present
  if (metadata) {
    // Build style JSONB from metadata
    if (metadata.color) {
      result.style = { color: metadata.color };
    }

    // Extract content (notes only, not title)
    if (metadata.notes) {
      result.content = metadata.notes;
    }

    // Extract attached assets
    if (metadata.attachedAssets) {
      result.attachedAssets = metadata.attachedAssets;
    }

    // Build metadata JSONB (remaining metadata including title)
    const pgMetadata: any = {};
    if (metadata.title) pgMetadata.title = metadata.title;
    if (metadata.kind) pgMetadata.kind = metadata.kind;
    if (metadata.tags) pgMetadata.tags = metadata.tags;
    if (metadata.noteGroups) pgMetadata.noteGroups = metadata.noteGroups;

    if (Object.keys(pgMetadata).length > 0) {
      result.metadata = pgMetadata;
    }
  }

  return result;
}

/**
 * Apply insert operation
 */
async function applyInsert(
  client: Pool | PoolClient,
  change: WriteChange
): Promise<any> {
  const schema = getSchemaForTable(change.table);
  const validated = schema.parse(change.payload);

  // Special handling for annotations - transform schema
  const transformed =
    change.table === "annotations"
      ? transformAnnotationData(validated)
      : validated;

  // Special handling for blob tables - convert ISO dates to epoch ms
  const blobTransformed = transformBlobData(
    change.table,
    transformed as Record<string, any>
  );

  const data = keysToSnakeCase(blobTransformed as Record<string, any>);

  // Build INSERT query
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

  // Determine conflict handling based on table
  let query: string;

  if (change.table === "blobs_meta") {
    // blobs_meta: unique on sha256
    query = `
      INSERT INTO ${change.table} (${columns.join(", ")})
      VALUES (${placeholders})
      ON CONFLICT (sha256) DO NOTHING
      RETURNING *
    `;
  } else if (change.table === "device_blobs") {
    // device_blobs: unique on (device_id, sha256)
    query = `
      INSERT INTO ${change.table} (${columns.join(", ")})
      VALUES (${placeholders})
      ON CONFLICT (device_id, sha256) DO NOTHING
      RETURNING *
    `;
  } else {
    // Other tables: update on conflict (LWW)
    query = `
      INSERT INTO ${change.table} (${columns.join(", ")})
      VALUES (${placeholders})
      ON CONFLICT (id) DO UPDATE SET
        ${columns.map((col, i) => `${col} = $${i + 1}`).join(", ")}
      RETURNING *
    `;
  }

  const result = await client.query(query, values);

  // If DO NOTHING was used and nothing was inserted, return null
  // (This is not an error - just means the record already existed)
  return result.rows[0] || null;
}

/**
 * Apply update operation with LWW conflict resolution
 */
async function applyUpdate(
  client: Pool | PoolClient,
  change: WriteChange
): Promise<any> {
  // For updates, we only receive partial data (changed fields)
  // So we need to use .partial() to allow optional fields
  const schema = getSchemaForTable(change.table);
  const partialSchema =
    schema instanceof z.ZodObject ? schema.partial() : schema;
  const validated = partialSchema.parse(change.payload);

  // Special handling for annotations - transform schema
  const transformed =
    change.table === "annotations"
      ? transformAnnotationData(validated)
      : validated;

  // Special handling for blob tables - convert ISO dates to epoch ms
  const blobTransformed = transformBlobData(
    change.table,
    transformed as Record<string, any>
  );

  const data = keysToSnakeCase(blobTransformed as Record<string, any>);

  // Check if record exists and compare timestamps
  const existing = await client.query(
    `SELECT updated_at FROM ${change.table} WHERE id = $1`,
    [data.id]
  );

  if (existing.rows.length === 0) {
    // Record doesn't exist, treat as insert
    return applyInsert(client, change);
  }

  // Last-write-wins: only update if client's timestamp >= server's timestamp
  const serverUpdatedAt = existing.rows[0].updated_at;
  const clientUpdatedAt = data.updated_at;

  if (clientUpdatedAt < serverUpdatedAt) {
    console.log(
      `[WritesBatch] Skipping update for ${change.table}/${data.id} - server is newer (server: ${serverUpdatedAt}, client: ${clientUpdatedAt})`
    );
    // Return existing record
    const result = await client.query(
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

  const result = await client.query(query, [data.id, ...values]);
  return result.rows[0];
}

/**
 * Apply delete operation (with tombstone support)
 */
async function applyDelete(
  client: Pool | PoolClient,
  change: WriteChange
): Promise<any> {
  const { id } = change.payload;

  // For now, hard delete
  // TODO: Add tombstone support for soft deletes
  const query = `
    DELETE FROM ${change.table}
    WHERE id = $1
    RETURNING id
  `;

  const result = await client.query(query, [id]);
  return result.rows[0] || { id, deleted: true };
}

/**
 * Apply a single write change
 * @param client - Postgres client (must be within a transaction)
 */
async function applyChange(
  client: PoolClient,
  change: WriteChange
): Promise<{ success: boolean; response?: any; error?: string }> {
  try {
    let response;

    switch (change.op) {
      case "insert":
        response = await applyInsert(client, change);
        break;
      case "update":
        response = await applyUpdate(client, change);
        break;
      case "delete":
        response = await applyDelete(client, change);
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
  console.log("[WritesBatch] API endpoint called!");

  // Check CORS origin
  const corsError = checkCorsOrigin(request);
  if (corsError) return corsError;

  const { getPostgresPool } = await import("@/app/api/lib/postgres");
  const pool = getPostgresPool();

  try {
    // Parse and validate request body
    const body = await request.json();
    const { changes } = BatchRequestSchema.parse(body);

    console.log(`[WritesBatch] Processing ${changes.length} changes`);

    // Sort changes to ensure foreign key dependencies are satisfied
    // blobs_meta must be inserted before device_blobs (foreign key constraint)
    const sortedChanges = [...changes].sort((a, b) => {
      const tableOrder = ["blobs_meta", "device_blobs"];
      const aIndex = tableOrder.indexOf(a.table);
      const bIndex = tableOrder.indexOf(b.table);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return 0;
    });

    // Apply changes in transaction
    const client = await pool.connect();
    const results: any[] = [];
    const appliedIds: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    try {
      await client.query("BEGIN");

      for (const change of sortedChanges) {
        // Use savepoint for each change to isolate errors
        const savepointName = `sp_${change.id.replace(/-/g, "_")}`;

        try {
          await client.query(`SAVEPOINT ${savepointName}`);
          const result = await applyChange(client, change);

          if (result.success) {
            results.push(result.response);
            appliedIds.push(change.id);
            await client.query(`RELEASE SAVEPOINT ${savepointName}`);
          } else {
            errors.push({
              id: change.id,
              error: result.error || "Unknown error",
            });
            await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          }
        } catch (error) {
          // Rollback this change but continue with others
          console.error(
            `[WritesBatch] Savepoint error for ${change.id}:`,
            error
          );
          try {
            await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          } catch (rollbackError) {
            console.error(
              `[WritesBatch] Failed to rollback savepoint:`,
              rollbackError
            );
          }
          errors.push({
            id: change.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      await client.query("COMMIT");
      console.log(
        `[WritesBatch] Successfully applied ${appliedIds.length}/${changes.length} changes`
      );
    } catch (error) {
      // Ensure we rollback even if there's an error
      try {
        await client.query("ROLLBACK");
        console.log("[WritesBatch] Transaction rolled back due to error");
      } catch (rollbackError) {
        console.error(
          "[WritesBatch] Failed to rollback transaction:",
          rollbackError
        );
      }
      throw error;
    } finally {
      // Always release the client, even if rollback failed
      try {
        client.release();
      } catch (releaseError) {
        console.error("[WritesBatch] Failed to release client:", releaseError);
      }
    }

    // Return results
    const response = NextResponse.json({
      success: true,
      applied: appliedIds,
      responses: results,
      errors: errors.length > 0 ? errors : undefined,
    });
    return addCorsHeaders(response, request);
  } catch (error) {
    console.error("[WritesBatch] Batch processing failed:", error);
    const response = NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
  // NOTE: Don't call pool.end() - we're using a singleton pool that stays alive
}
