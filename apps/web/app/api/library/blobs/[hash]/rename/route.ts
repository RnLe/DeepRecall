/**
 * PUT /api/library/blobs/[hash]/rename
 * Rename a blob's filename in the database and on the filesystem
 */

import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/src/server/db";
import { blobs, paths } from "@/src/server/schema";
import { eq } from "drizzle-orm";
import { rename } from "fs/promises";
import path from "path";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;
    const { filename } = await request.json();

    if (!hash || !filename) {
      return NextResponse.json(
        { error: "Hash and filename are required" },
        { status: 400 }
      );
    }

    // Validate filename (no path separators)
    if (filename.includes("/") || filename.includes("\\")) {
      return NextResponse.json(
        { error: "Filename cannot contain path separators" },
        { status: 400 }
      );
    }

    const db = getDB();

    // Get current blob and path
    const blob = await db
      .select()
      .from(blobs)
      .where(eq(blobs.hash, hash))
      .get();

    if (!blob) {
      return NextResponse.json({ error: "Blob not found" }, { status: 404 });
    }

    const pathRecord = await db
      .select()
      .from(paths)
      .where(eq(paths.hash, hash))
      .get();

    if (!pathRecord) {
      return NextResponse.json(
        { error: "Path record not found" },
        { status: 404 }
      );
    }

    const oldPath = pathRecord.path;
    const directory = path.dirname(oldPath);
    const newPath = path.join(directory, filename);

    // Rename file on disk
    try {
      await rename(oldPath, newPath);
    } catch (error) {
      console.error("File rename failed:", error);
      return NextResponse.json(
        { error: "Failed to rename file on disk" },
        { status: 500 }
      );
    }

    // Update database records
    await db.update(blobs).set({ filename }).where(eq(blobs.hash, hash));

    await db.update(paths).set({ path: newPath }).where(eq(paths.hash, hash));

    return NextResponse.json({
      success: true,
      filename,
      path: newPath,
    });
  } catch (error) {
    console.error("Rename failed:", error);
    return NextResponse.json(
      { error: "Failed to rename blob" },
      { status: 500 }
    );
  }
}
