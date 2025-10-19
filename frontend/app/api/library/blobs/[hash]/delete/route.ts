/**
 * DELETE /api/library/blobs/[hash]/delete
 * Delete a blob from database and optionally from filesystem
 */

import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/src/server/db";
import { blobs, paths } from "@/src/server/schema";
import { eq } from "drizzle-orm";
import { unlink } from "fs/promises";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;
    const { deleteFile } = await request
      .json()
      .catch(() => ({ deleteFile: false }));

    if (!hash) {
      return NextResponse.json({ error: "Hash is required" }, { status: 400 });
    }

    const db = getDB();

    // Get path before deleting if we need to delete the file
    let filePath: string | null = null;
    if (deleteFile) {
      const pathRecord = await db
        .select()
        .from(paths)
        .where(eq(paths.hash, hash))
        .get();

      if (pathRecord) {
        filePath = pathRecord.path;
      }
    }

    // Delete path mappings first (foreign key constraint)
    await db.delete(paths).where(eq(paths.hash, hash));

    // Delete the blob from database
    await db.delete(blobs).where(eq(blobs.hash, hash));

    // Optionally delete file from disk
    if (deleteFile && filePath) {
      try {
        await unlink(filePath);
      } catch (error) {
        console.error("Failed to delete file from disk:", error);
        // Don't fail the whole operation if file delete fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `Blob ${hash.slice(0, 16)}... deleted`,
      fileDeleted: deleteFile && filePath !== null,
    });
  } catch (error) {
    console.error("Delete failed:", error);
    return NextResponse.json(
      { error: "Failed to delete blob" },
      { status: 500 }
    );
  }
}
