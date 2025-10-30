/**
 * PUT /api/library/blobs/[hash]/update
 * Update a markdown file - creates a new blob and DELETES the old one completely
 * This ensures only one version exists (no history)
 */

import { NextResponse } from "next/server";
import { storeBlob, deleteBlob } from "@/src/server/cas";
import { getDB } from "@/src/server/db";
import { blobs, paths } from "@/src/server/schema";
import { eq } from "drizzle-orm";
import { rename } from "fs/promises";
import path from "path";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash: oldHash } = await params;
    const body = await request.json();
    const { content, filename, deviceId } = body;

    if (!content || !filename) {
      return NextResponse.json(
        { error: "Content and filename are required" },
        { status: 400 }
      );
    }

    // Validate filename has .md extension
    if (!filename.endsWith(".md")) {
      return NextResponse.json(
        { error: "Filename must end with .md" },
        { status: 400 }
      );
    }

    const db = getDB();

    // Store new blob with the provided filename
    const buffer = Buffer.from(content, "utf-8");
    const { hash: newHash, path: newPath } = await storeBlob(
      buffer,
      filename,
      "notes",
      deviceId
    );

    // Always delete the old blob completely (database + disk) FIRST
    // This frees up the desired filename path in the database
    if (oldHash && oldHash !== newHash) {
      await deleteBlob(oldHash);
    }

    // Rename the physical file to match the desired filename
    // CAS stores as ${hash}.md, but we want user-facing filename on disk
    const directory = path.dirname(newPath);
    const desiredPath = path.join(directory, filename);

    if (newPath !== desiredPath) {
      try {
        await rename(newPath, desiredPath);
        console.log(`Renamed file: ${newPath} → ${desiredPath}`);

        // Delete the old path entry and insert new one
        // (path is primary key, so we can't update to an existing path)
        await db.delete(paths).where(eq(paths.hash, newHash)).run();
        await db
          .insert(paths)
          .values({
            hash: newHash,
            path: desiredPath,
          })
          .run();
      } catch (error) {
        console.error("Failed to rename file:", error);
        // Continue anyway - file exists with hash name
      }
    }

    return NextResponse.json({
      success: true,
      hash: newHash,
      filename,
      path: desiredPath,
    });
  } catch (error) {
    console.error("Error updating blob:", error);
    return NextResponse.json(
      { error: "Failed to update blob" },
      { status: 500 }
    );
  }
}
