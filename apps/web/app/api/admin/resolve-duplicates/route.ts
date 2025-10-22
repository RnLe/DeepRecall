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

interface ResolutionRequest {
  mode: "user-selection" | "auto-resolve";
  resolutions: Array<{
    hash: string;
    keepPath: string; // Path to keep
    deletePaths?: string[]; // Paths to delete (user-selection mode only)
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body: ResolutionRequest = await request.json();
    const { mode, resolutions } = body;

    console.log(
      `[Resolution API] Mode: ${mode}, Processing ${resolutions.length} duplicate groups`
    );

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
              console.log(`✓ Deleted: ${deletePath}`);
              results.deleted++;

              // Remove path mapping from database
              await db.delete(paths).where(eq(paths.path, deletePath));
            } catch (error) {
              console.error(`Failed to delete ${deletePath}:`, error);
              results.errors.push(`Failed to delete ${deletePath}`);
            }
          }
        } else {
          // AUTO-RESOLVE MODE: Don't add ignored files to database at all
          // They remain on disk but are not tracked - future scans will detect them again
          // but that's expected behavior (user chose to skip them)
          console.log(
            `   Skipping ${deletePaths?.length || 0} ignored duplicates (not added to database)`
          );
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

        console.log(
          `✓ Resolved: ${keepPath} (${hash.slice(0, 16)}...) - Mode: ${mode}`
        );
        console.log(
          `  Created 1 blob entry (health: ${healthStatus}) + 1 path entry`
        );
        if (mode === "auto-resolve") {
          console.log(
            `  Ignored ${deletePaths?.length || 0} other files (not added to database)`
          );
        }

        results.resolved++;
      } catch (error) {
        console.error(`Failed to resolve hash ${hash}:`, error);
        results.errors.push(
          `Failed to resolve ${hash.slice(0, 16)}...: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Duplicate resolution failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Duplicate resolution failed",
      },
      { status: 500 }
    );
  }
}
