/**
 * DELETE /api/admin/database/blobs
 * Deletes all blob files from disk (CAS storage)
 * Part of emergency database wipe
 */

import { NextResponse } from "next/server";
import { readdir, unlink, stat } from "fs/promises";
import path from "path";

function getLibraryPath(): string {
  const dataPath =
    process.env.DATA_PATH || path.join(process.cwd(), "../../data");
  return process.env.LIBRARY_PATH || path.join(dataPath, "library");
}

export async function DELETE() {
  try {
    console.log("🗑️  Deleting all blob files from disk...");
    const libraryPath = getLibraryPath();

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
              console.warn(`  ⚠️  Failed to delete ${filePath}:`, error);
              failedCount++;
            }
          }
        }
      } catch (error) {
        // Directory might not exist, that's fine
        console.log(`  ℹ️  Directory ${dir} not found or empty`);
      }
    }

    console.log(
      `✅ Deleted ${deletedCount} blob files (${failedCount} failed)`
    );

    return NextResponse.json({
      success: true,
      message: "Blob files deleted",
      deleted: deletedCount,
      failed: failedCount,
    });
  } catch (error) {
    console.error("❌ Error deleting blob files:", error);
    return NextResponse.json(
      {
        error: "Failed to delete blob files",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
