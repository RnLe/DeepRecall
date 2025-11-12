/**
 * GET /api/admin/blobs
 * Returns raw blob records from database with paths (admin/debug only)
 */

import { NextRequest, NextResponse } from "next/server";
import { listFilesWithPaths } from "@/src/server/cas";
import { logger } from "@deeprecall/telemetry";

export async function GET(request: NextRequest) {
  // Require authentication
  const { requireAuth } = await import("@/app/api/lib/auth-helpers");
  try {
    await requireAuth(request);
  } catch (error) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    // Return blobs with their filesystem paths
    const blobs = await listFilesWithPaths();
    return NextResponse.json(blobs);
  } catch (error) {
    logger.error("cas", "Failed to fetch blobs list for admin", {
      error: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Failed to fetch blobs" },
      { status: 500 }
    );
  }
}
