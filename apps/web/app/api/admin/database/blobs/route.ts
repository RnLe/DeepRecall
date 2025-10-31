/**
 * DELETE /api/admin/database/blobs
 * Deletes all blob files from disk (CAS storage)
 * Part of emergency database wipe
 */

import { NextResponse } from "next/server";
import { readdir, unlink, stat } from "fs/promises";
import path from "path";
import { logger } from "@deeprecall/telemetry";

function getLibraryPath(): string {
  const dataPath = process.env.DATA_PATH || path.join(process.cwd(), "data");
  return process.env.LIBRARY_PATH || path.join(dataPath, "library");
}

export async function DELETE() {
  try {
    const libraryPath = getLibraryPath();
    logger.warn("cas", "EMERGENCY: Deleting all blob files from disk", {
      libraryPath,
    });

    let deletedCount = 0;
    let failedCount = 0;

    // Delete all files recursively from library directories
    const directories = [
      "main",
      "notes",
      "thumbnails",
      "supplements",
      "slides",
      "solutions",
      "exercises",
      "data",
    ];

    for (const dir of directories) {
      const dirPath = path.join(libraryPath, dir);
      try {
        const files = await readdir(dirPath, { recursive: true });

        for (const file of files) {
          const filePath = path.join(dirPath, file);
          try {
            // Check if it's a file (not a directory)
            const stats = await stat(filePath);
            if (stats.isFile()) {
              await unlink(filePath);
              deletedCount++;
            }
            // Skip directories silently
          } catch (error: any) {
            // Ignore ENOENT (file disappeared between readdir and stat)
            if (error.code !== "ENOENT") {
              logger.warn("cas", "Failed to delete blob file", {
                path: filePath,
                error: error.message,
              });
              failedCount++;
            }
          }
        }
      } catch (error) {
        // Directory might not exist, that's fine
        logger.debug("cas", "Directory not found or empty", { dir });
      }
    }

    logger.info("cas", "Blob file deletion completed", {
      deleted: deletedCount,
      failed: failedCount,
    });

    return NextResponse.json({
      success: true,
      message: "Blob files deleted",
      deleted: deletedCount,
      failed: failedCount,
    });
  } catch (error) {
    logger.error("cas", "Failed to delete blob files", {
      error: (error as Error).message,
    });
    return NextResponse.json(
      {
        error: "Failed to delete blob files",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
