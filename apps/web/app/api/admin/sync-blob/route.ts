/**
 * POST /api/admin/sync-blob
 * Syncs a single blob from CAS to Electric/Postgres
 * Used when linking orphaned blobs to ensure blob metadata exists before asset creation
 */

import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/src/server/db";
import { blobs, paths } from "@/src/server/schema";
import { eq } from "drizzle-orm";
import {
  handleCorsOptions,
  checkCorsOrigin,
  addCorsHeaders,
} from "@/app/api/lib/cors";
import { logger } from "@deeprecall/telemetry";

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

export async function POST(request: NextRequest) {
  // Check CORS origin
  const corsError = checkCorsOrigin(request);
  if (corsError) return corsError;

  // Require authentication
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
      logger.info("sync.coordination", "Syncing blob from CAS to Postgres", {
        sha256: sha256.slice(0, 16),
        deviceId: deviceId.slice(0, 8),
        size: blob.size,
        mime: blob.mime,
        ownerId: userContext.userId.slice(0, 8),
      });

      // Get path for local_path info
      const pathRecord = await db
        .select()
        .from(paths)
        .where(eq(paths.hash, sha256))
        .get();

      // Create blobs_meta entry directly in Postgres (idempotent)
      await createBlobMetaServer({
        sha256: blob.hash,
        size: blob.size,
        mime: blob.mime,
        ownerId: userContext.userId, // Set owner from authenticated user
        filename: blob.filename,
        // Note: We don't have pageCount etc. stored in old CAS blobs
      });

      // Mark as available on this device directly in Postgres (idempotent)
      const localPath = pathRecord?.path || null;
      await markBlobAvailableServer(
        blob.hash,
        deviceId,
        userContext.userId, // Set owner from authenticated user
        localPath,
        "healthy"
      );

      logger.info("sync.coordination", "Blob synced successfully", {
        sha256: sha256.slice(0, 16),
        deviceId: deviceId.slice(0, 8),
      });
    } else {
      // Blob doesn't exist in local CAS - it's on another device
      logger.debug(
        "sync.coordination",
        "Blob not in local CAS, already synced from another device",
        {
          sha256: sha256.slice(0, 16),
          deviceId: deviceId.slice(0, 8),
        }
      );
    }

    const response = NextResponse.json({
      success: true,
      sha256: sha256,
    });
    return addCorsHeaders(response, request);
  } catch (error) {
    logger.error("sync.coordination", "Failed to sync blob", {
      error: (error as Error).message,
    });
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const response = NextResponse.json(
      {
        error: "Failed to sync blob",
        message: errorMessage,
        stack: errorStack,
      },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
}
