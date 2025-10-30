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
    const { sha256, deviceId } = await request.json();

    if (!sha256) {
      return NextResponse.json(
        { error: "Missing sha256 parameter" },
        { status: 400 }
      );
    }

    if (!deviceId) {
      return NextResponse.json(
        { error: "Missing deviceId parameter" },
        { status: 400 }
      );
    }

    console.log(
      `[SyncBlob] Sync requested for blob ${sha256.slice(0, 16)}... by device ${deviceId.slice(0, 8)}...`
    );

    // Import server-safe write functions (write directly to Postgres)
    const { createBlobMetaServer, markBlobAvailableServer } = await import(
      "@deeprecall/data/repos/blobs.server"
    );

    // Try to get blob from local CAS first
    const db = getDB();
    const blob = await db
      .select()
      .from(blobs)
      .where(eq(blobs.hash, sha256))
      .get();

    if (blob) {
      // Blob exists in local CAS - sync it to Postgres
      console.log(`[SyncBlob] Found blob in local CAS, syncing to Postgres...`);

      // Get path for local_path info
      const pathRecord = await db
        .select()
        .from(paths)
        .where(eq(paths.hash, sha256))
        .get();

      // Create blobs_meta entry directly in Postgres (idempotent)
      console.log(`[SyncBlob] Creating blobs_meta entry...`);
      await createBlobMetaServer({
        sha256: blob.hash,
        size: blob.size,
        mime: blob.mime,
        filename: blob.filename,
        // Note: We don't have pageCount etc. stored in old CAS blobs
      });
      console.log(`[SyncBlob] ✅ Created blobs_meta entry`);

      // Mark as available on this device directly in Postgres (idempotent)
      const localPath = pathRecord?.path || null;
      console.log(`[SyncBlob] Marking blob as available on device...`);
      await markBlobAvailableServer(blob.hash, deviceId, localPath, "healthy");
      console.log(`[SyncBlob] ✅ Marked blob as available`);
    } else {
      // Blob doesn't exist in local CAS - it's on another device
      // This is OK! The blob already exists in Postgres (from the other device)
      // We don't need to do anything - just return success
      console.log(
        `[SyncBlob] Blob not in local CAS (exists on another device) - already synced, skipping`
      );
    }

    console.log(
      `[SyncBlob] ✅ Synced blob ${sha256.slice(0, 16)} for device ${deviceId.slice(0, 8)}...`
    );

    return NextResponse.json({
      success: true,
      sha256: sha256,
    });
  } catch (error) {
    console.error("[SyncBlob] Error syncing blob:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        error: "Failed to sync blob",
        message: errorMessage,
        stack: errorStack,
      },
      { status: 500 }
    );
  }
}
