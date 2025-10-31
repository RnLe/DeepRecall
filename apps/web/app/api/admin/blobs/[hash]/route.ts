/**
 * DELETE /api/admin/blobs/[hash]
 * Deletes a specific blob and its path mappings from the database
 * Does NOT delete the actual file from disk
 */

import { NextResponse } from "next/server";
import { getDB } from "@/src/server/db";
import { blobs, paths } from "@/src/server/schema";
import { eq } from "drizzle-orm";
import { logger } from "@deeprecall/telemetry";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;

    if (!hash) {
      return NextResponse.json(
        { error: "Hash parameter is required" },
        { status: 400 }
      );
    }

    const db = getDB();

    // Delete path mappings first (foreign key constraint)
    await db.delete(paths).where(eq(paths.hash, hash));

    // Delete the blob from CAS
    const result = await db.delete(blobs).where(eq(blobs.hash, hash));

    // Also delete from Electric coordination (async, non-blocking)
    try {
      const { deleteBlobMetaServer, deleteDeviceBlobServer } = await import(
        "@deeprecall/data/repos/blobs.server"
      );

      // Delete device blob entries (will cascade to all devices via Electric)
      await deleteDeviceBlobServer(hash, "server");

      // Delete blob metadata (will cascade delete device_blobs via FK)
      await deleteBlobMetaServer(hash);

      logger.info("sync.coordination", "Blob deleted from CAS and Electric", {
        hash: hash.slice(0, 16),
      });
    } catch (electricError) {
      logger.warn(
        "sync.coordination",
        "Blob deleted from CAS but failed to sync to Electric",
        {
          hash: hash.slice(0, 16),
          error: (electricError as Error).message,
        }
      );
      // Continue anyway - CAS deletion succeeded
    }

    return NextResponse.json({
      success: true,
      message: `Blob ${hash.slice(0, 16)}... deleted`,
    });
  } catch (error) {
    logger.error("server.api", "Failed to delete blob", {
      hash: (await params).hash.slice(0, 16),
      error: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Failed to delete blob" },
      { status: 500 }
    );
  }
}
