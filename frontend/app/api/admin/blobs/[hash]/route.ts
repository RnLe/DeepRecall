/**
 * DELETE /api/admin/blobs/[hash]
 * Deletes a specific blob and its path mappings from the database
 * Does NOT delete the actual file from disk
 */

import { NextResponse } from "next/server";
import { getDB } from "@/src/server/db";
import { blobs, paths } from "@/src/server/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  request: Request,
  { params }: { params: { hash: string } }
) {
  try {
    const { hash } = params;

    if (!hash) {
      return NextResponse.json(
        { error: "Hash parameter is required" },
        { status: 400 }
      );
    }

    const db = getDB();

    // Delete path mappings first (foreign key constraint)
    await db.delete(paths).where(eq(paths.hash, hash));

    // Delete the blob
    const result = await db.delete(blobs).where(eq(blobs.hash, hash));

    return NextResponse.json({
      success: true,
      message: `Blob ${hash.slice(0, 16)}... deleted`,
    });
  } catch (error) {
    console.error("Error deleting blob:", error);
    return NextResponse.json(
      { error: "Failed to delete blob" },
      { status: 500 }
    );
  }
}
