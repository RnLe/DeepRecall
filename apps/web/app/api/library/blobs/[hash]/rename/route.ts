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
import { logger } from "@deeprecall/telemetry";

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
      logger.error("cas", "Failed to rename blob file on disk", {
        hash: hash.slice(0, 16),
        oldFilename: path.basename(oldPath),
        newFilename: filename,
        error: (error as Error).message,
      });
      return NextResponse.json(
        { error: "Failed to rename file on disk" },
        { status: 500 }
      );
    }

    // Update CAS database records
    await db.update(blobs).set({ filename }).where(eq(blobs.hash, hash));
    await db.update(paths).set({ path: newPath }).where(eq(paths.hash, hash));

    // Also update Electric coordination (async, non-blocking)
    try {
      const { updateBlobMetaServer } = await import(
        "@deeprecall/data/repos/blobs.server"
      );
      await updateBlobMetaServer(hash, { filename });
      logger.info("sync.coordination", "Blob renamed and synced to Electric", {
        hash: hash.slice(0, 16),
        filename,
      });
    } catch (electricError) {
      logger.warn(
        "sync.coordination",
        "Blob renamed locally but failed to sync to Electric",
        {
          hash: hash.slice(0, 16),
          error: (electricError as Error).message,
        }
      );
      // Continue anyway - CAS update succeeded
    }

    return NextResponse.json({
      success: true,
      filename,
      path: newPath,
    });
  } catch (error) {
    logger.error("server.api", "Failed to rename blob", {
      hash: (await params).hash.slice(0, 16),
      error: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Failed to rename blob" },
      { status: 500 }
    );
  }
}
