/**
 * POST /api/admin/sync-to-electric
 * Backfill Electric coordination entries for existing CAS blobs
 * This creates blobs_meta and device_blobs entries for all blobs that don't have them
 */

import { NextResponse } from "next/server";
import { getDB } from "@/src/server/db";
import { blobs, paths } from "@/src/server/schema";

export async function POST() {
  try {
    const db = getDB();

    // Get all blobs from CAS
    const allBlobs = await db.select().from(blobs).all();

    console.log(`[SyncToElectric] Found ${allBlobs.length} blobs in CAS`);

    let synced = 0;
    let failed = 0;

    // Import server-safe write functions (write directly to Postgres)
    const { createBlobMetaServer, markBlobAvailableServer } = await import(
      "@deeprecall/data/repos/blobs.server"
    );

    // Get paths for local_path info
    const allPaths = await db.select().from(paths).all();
    const pathsByHash = new Map(allPaths.map((p) => [p.hash, p.path]));

    for (const blob of allBlobs) {
      try {
        // Create blobs_meta entry directly in Postgres
        await createBlobMetaServer({
          sha256: blob.hash,
          size: blob.size,
          mime: blob.mime,
          filename: blob.filename,
          // Note: We don't have pageCount etc. stored in old CAS blobs
        });

        // Mark as available on server directly in Postgres
        const localPath = pathsByHash.get(blob.hash) || null;
        await markBlobAvailableServer(
          blob.hash,
          "server",
          localPath,
          "healthy"
        );

        synced++;
      } catch (error) {
        console.error(
          `[SyncToElectric] Failed to sync blob ${blob.hash.slice(0, 16)}...`,
          error
        );
        failed++;
      }
    }

    console.log(`[SyncToElectric] Synced ${synced} blobs, ${failed} failed`);

    return NextResponse.json({
      success: true,
      synced,
      failed,
      total: allBlobs.length,
    });
  } catch (error) {
    console.error("[SyncToElectric] Failed:", error);
    return NextResponse.json(
      { error: "Failed to sync to Electric" },
      { status: 500 }
    );
  }
}
