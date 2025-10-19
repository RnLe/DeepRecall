/**
 * PUT /api/library/blobs/[hash]/update
 * Update a markdown file - creates a new blob and updates references
 */

import { NextResponse } from "next/server";
import { storeBlob } from "@/src/server/cas";
import { getDB } from "@/src/server/db";
import { blobs, paths } from "@/src/server/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash: oldHash } = await params;
    const body = await request.json();
    const { content, filename } = body;

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

    // Get old paths for this blob
    const oldPaths = await db
      .select()
      .from(paths)
      .where(eq(paths.hash, oldHash))
      .all();

    // Store new blob with updated content
    const buffer = Buffer.from(content, "utf-8");
    const { hash: newHash, path: newPath } = await storeBlob(
      buffer,
      filename,
      "notes"
    );

    // Handle path and blob updates
    if (newHash !== oldHash) {
      // Content changed - new hash
      for (const oldPath of oldPaths) {
        // Delete old path reference
        await db.delete(paths).where(eq(paths.path, oldPath.path)).run();

        // Add new path reference with new hash
        await db
          .insert(paths)
          .values({
            path: oldPath.path,
            hash: newHash,
          })
          .run();
      }

      // Delete the old blob entry since we have a new one
      await db.delete(blobs).where(eq(blobs.hash, oldHash)).run();

      // Update the new blob's filename
      await db
        .update(blobs)
        .set({ filename })
        .where(eq(blobs.hash, newHash))
        .run();
    } else {
      // Content unchanged - same hash
      // Just update the filename on the existing blob
      await db
        .update(blobs)
        .set({ filename })
        .where(eq(blobs.hash, newHash))
        .run();
    }

    return NextResponse.json({
      success: true,
      hash: newHash,
      filename,
      path: newPath,
    });
  } catch (error) {
    console.error("Error updating blob:", error);
    return NextResponse.json(
      { error: "Failed to update blob" },
      { status: 500 }
    );
  }
}
