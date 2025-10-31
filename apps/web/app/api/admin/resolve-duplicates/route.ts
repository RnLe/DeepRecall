/**
 * POST /api/admin/resolve-duplicates
 * Resolves duplicate files based on user selection
 * Can either delete unwanted files (user choice) or mark as duplicate (auto-resolve)
 */

import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { getDB } from "@/src/server/db";
import { blobs, paths } from "@/src/server/schema";
import { eq } from "drizzle-orm";
import { hashFile } from "@/src/server/hash";
import { getMimeType } from "@/src/server/cas";
import { stat } from "fs/promises";
import {
  handleCorsOptions,
  checkCorsOrigin,
  addCorsHeaders,
} from "@/app/api/lib/cors";
import { logger } from "@deeprecall/telemetry";

interface ResolutionRequest {
  mode: "user-selection" | "auto-resolve";
  resolutions: Array<{
    hash: string;
    keepPath: string; // Path to keep
    deletePaths?: string[]; // Paths to delete (user-selection mode only)
  }>;
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

export async function POST(request: NextRequest) {
  // Check CORS origin
  const corsError = checkCorsOrigin(request);
  if (corsError) return corsError;
  try {
    const body: ResolutionRequest = await request.json();
    const { mode, resolutions } = body;

    logger.info("cas", "Starting duplicate resolution", {
      mode,
      groupCount: resolutions.length,
    });

    const db = getDB();
    const results = {
      resolved: 0,
      deleted: 0,
      markedDuplicate: 0,
      errors: [] as string[],
    };

    for (const resolution of resolutions) {
      const { hash, keepPath, deletePaths } = resolution;

      try {
        // Verify the keep path still exists and hash matches
        const keepStats = await stat(keepPath);
        const keepHash = await hashFile(keepPath);

        if (keepHash !== hash) {
          results.errors.push(
            `Hash mismatch for ${keepPath} (expected ${hash.slice(0, 16)}..., got ${keepHash.slice(0, 16)}...)`
          );
          continue;
        }

        const mime = getMimeType(keepPath);
        const filename = keepPath.split("/").pop() || "unknown";

        if (mode === "user-selection") {
          // USER SELECTION MODE: Delete unwanted files from disk
          for (const deletePath of deletePaths || []) {
            try {
              await unlink(deletePath);
              results.deleted++;

              // Remove path mapping from database
              await db.delete(paths).where(eq(paths.path, deletePath));
            } catch (error) {
              logger.error("cas", "Failed to delete duplicate file", {
                path: deletePath,
                hash: hash.slice(0, 16),
                error: (error as Error).message,
              });
              results.errors.push(`Failed to delete ${deletePath}`);
            }
          }
        } else {
          // AUTO-RESOLVE MODE: Don't add ignored files to database at all
          results.markedDuplicate += deletePaths?.length || 0;
        }

        // Update/create blob entry for kept file
        // In user-selection mode: mark as "healthy" (user explicitly chose this file)
        // In auto-resolve mode: mark as "duplicate" (kept for convenience, but still a duplicate)
        const healthStatus =
          mode === "user-selection" ? "healthy" : "duplicate";

        await db
          .insert(blobs)
          .values({
            hash,
            size: keepStats.size,
            mime,
            mtime_ms: keepStats.mtimeMs,
            created_ms: Date.now(),
            filename,
            health: healthStatus,
          })
          .onConflictDoUpdate({
            target: blobs.hash,
            set: {
              size: keepStats.size,
              mime,
              mtime_ms: keepStats.mtimeMs,
              filename,
              health: healthStatus,
            },
          });

        // Create path mapping for kept file (both modes)
        await db
          .insert(paths)
          .values({
            hash,
            path: keepPath,
          })
          .onConflictDoUpdate({
            target: paths.path,
            set: { hash },
          });

        logger.info("cas", "Duplicate resolved successfully", {
          hash: hash.slice(0, 16),
          keepPath,
          mode,
          healthStatus,
          deletedCount: deletePaths?.length || 0,
        });

        results.resolved++;
      } catch (error) {
        logger.error("cas", "Failed to resolve duplicate", {
          hash: hash.slice(0, 16),
          error: (error as Error).message,
        });
        results.errors.push(
          `Failed to resolve ${hash.slice(0, 16)}...: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    logger.info("cas", "Duplicate resolution completed", {
      resolved: results.resolved,
      deleted: results.deleted,
      markedDuplicate: results.markedDuplicate,
      errorCount: results.errors.length,
    });

    const response = NextResponse.json({
      success: true,
      ...results,
    });
    return addCorsHeaders(response, request);
  } catch (error) {
    logger.error("cas", "Duplicate resolution failed", {
      error: (error as Error).message,
    });
    const response = NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Duplicate resolution failed",
      },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
}
