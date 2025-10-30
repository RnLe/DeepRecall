/**
 * POST /api/admin/sync-to-electric
 * Backfill Electric coordination entries for existing CAS blobs
 * This creates blobs_meta and device_blobs entries for all blobs that don't have them
 */

import { NextResponse } from "next/server";
import { getDB } from "@/src/server/db";
import { blobs, paths } from "@/src/server/schema";

export async function POST(request: Request) {
  try {
    // Get device ID from client
    const body = await request.json().catch(() => ({}));
    const clientDeviceId = body.deviceId;

    if (!clientDeviceId) {
      return NextResponse.json(
        { error: "Device ID is required" },
        { status: 400 }
      );
    }

    const db = getDB();

    // Get all blobs from CAS
    const allBlobs = await db.select().from(blobs).all();

    console.log(`[SyncToElectric] Found ${allBlobs.length} blobs in CAS`);

    let synced = 0;
    let failed = 0;

    // Use write buffer API instead of direct Postgres (works with Electric Cloud)
    // Construct the base URL from the request to call our own API
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host") || "localhost:3000";
    const apiBaseUrl = `${protocol}://${host}`;

    // Get paths for local_path info
    const allPaths = await db.select().from(paths).all();
    const pathsByHash = new Map(allPaths.map((p) => [p.hash, p.path]));

    // Use client's device ID instead of server-side fallback
    const { v4: uuidv4 } = await import("uuid");
    const deviceId = clientDeviceId;
    console.log(
      `[SyncToElectric] Using device ID: ${deviceId.slice(0, 16)}...`
    );

    const now = Date.now();
    const nowISO = new Date(now).toISOString();

    // Build changes in two phases: blobs_meta first (required by foreign key), then device_blobs
    const blobsMetaChanges: any[] = [];
    const deviceBlobsChanges: any[] = [];

    for (const blob of allBlobs) {
      const localPath = pathsByHash.get(blob.hash) || null;

      // Create blobs_meta entry
      // Note: blobs_meta uses sha256 as primary key, not id
      blobsMetaChanges.push({
        id: uuidv4(), // Write change tracking ID
        table: "blobs_meta",
        op: "insert",
        payload: {
          sha256: blob.hash,
          size: blob.size,
          mime: blob.mime,
          filename: blob.filename || `${blob.hash.slice(0, 16)}.bin`,
          createdAt: new Date(blob.created_ms || now).toISOString(), // Schema expects ISO date string
        },
        created_at: now,
        status: "pending",
        retry_count: 0,
      });

      // Create device_blobs entry with proper schema
      deviceBlobsChanges.push({
        id: uuidv4(), // Generate proper UUID
        table: "device_blobs",
        op: "insert",
        payload: {
          id: uuidv4(), // Schema requires id field
          deviceId: deviceId, // camelCase
          sha256: blob.hash,
          present: true,
          localPath: localPath, // camelCase
          health: "healthy",
          createdAt: nowISO, // ISO date string
          updatedAt: nowISO, // ISO date string
        },
        created_at: now,
        status: "pending",
        retry_count: 0,
      });
    }

    // Combine in correct order: blobs_meta first, then device_blobs
    const changes = [...blobsMetaChanges, ...deviceBlobsChanges];

    // Send all changes in one batch request
    try {
      const response = await fetch(`${apiBaseUrl}/api/writes/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Batch API failed: ${response.status} ${errorText}`);
      }

      synced = allBlobs.length;
      console.log(
        `[SyncToElectric] Successfully sent ${changes.length} changes to batch API`
      );
    } catch (error) {
      console.error("[SyncToElectric] Batch API request failed:", error);
      failed = allBlobs.length;
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
