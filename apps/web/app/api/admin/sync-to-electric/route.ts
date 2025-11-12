/**
 * POST /api/admin/sync-to-electric
 * Backfill Electric coordination entries for existing CAS blobs
 * This creates blobs_meta and device_blobs entries for all blobs that don't have them
 */

import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/src/server/db";
import { blobs, paths } from "@/src/server/schema";
import { logger } from "@deeprecall/telemetry";

export async function POST(request: NextRequest) {
  // Require authentication and get user context
  const { requireAuth } = await import("@/app/api/lib/auth-helpers");
  let userContext;
  try {
    userContext = await requireAuth(request);
  } catch (error) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

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

    logger.info("sync.coordination", "Starting Electric sync backfill", {
      blobCount: allBlobs.length,
      deviceId: clientDeviceId.slice(0, 8),
    });

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
          ownerId: userContext.userId, // Add owner_id for RLS
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
          ownerId: userContext.userId, // Add owner_id for RLS
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
        headers: {
          "Content-Type": "application/json",
          // Forward cookies from the original request for authentication
          Cookie: request.headers.get("cookie") || "",
        },
        body: JSON.stringify({ changes }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Batch API failed: ${response.status} ${errorText}`);
      }

      synced = allBlobs.length;
      logger.info("sync.coordination", "Electric sync backfill completed", {
        synced,
        changeCount: changes.length,
      });
    } catch (error) {
      logger.error(
        "sync.coordination",
        "Batch API request failed during sync",
        {
          error: (error as Error).message,
        }
      );
      failed = allBlobs.length;
    }

    return NextResponse.json({
      success: true,
      synced,
      failed,
      total: allBlobs.length,
    });
  } catch (error) {
    logger.error("sync.coordination", "Electric sync backfill failed", {
      error: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Failed to sync to Electric" },
      { status: 500 }
    );
  }
}
