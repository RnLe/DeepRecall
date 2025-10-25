/**
 * POST /api/admin/sync-blob
 * Syncs a single blob from CAS to Electric/Postgres
 * Used when linking orphaned blobs to ensure blob metadata exists before asset creation
 */

import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/src/server/db";
import { blobs, paths } from "@/src/server/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { sha256 } = await request.json();

    if (!sha256) {
      return NextResponse.json(
        { error: "Missing sha256 parameter" },
        { status: 400 }
      );
    }

    const db = getDB();

    // Get blob from CAS
    const blob = await db
      .select()
      .from(blobs)
      .where(eq(blobs.hash, sha256))
      .get();

    if (!blob) {
      return NextResponse.json(
        { error: `Blob ${sha256} not found in CAS` },
        { status: 404 }
      );
    }

    console.log(`[SyncBlob] Syncing blob ${sha256.slice(0, 16)}...`);

    // Import server-safe write functions (write directly to Postgres)
    const { createBlobMetaServer, markBlobAvailableServer } = await import(
      "@deeprecall/data/repos/blobs.server"
    );

    // Get path for local_path info
    const pathRecord = await db
      .select()
      .from(paths)
      .where(eq(paths.hash, sha256))
      .get();

    // Create blobs_meta entry directly in Postgres
    await createBlobMetaServer({
      sha256: blob.hash,
      size: blob.size,
      mime: blob.mime,
      filename: blob.filename,
      // Note: We don't have pageCount etc. stored in old CAS blobs
    });

    // Mark as available on server directly in Postgres
    const localPath = pathRecord?.path || null;
    await markBlobAvailableServer(blob.hash, "server", localPath, "healthy");

    console.log(`[SyncBlob] ✅ Synced blob ${sha256.slice(0, 16)}`);

    return NextResponse.json({
      success: true,
      sha256: blob.hash,
    });
  } catch (error) {
    console.error("[SyncBlob] Failed:", error);
    return NextResponse.json(
      {
        error: "Failed to sync blob",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
