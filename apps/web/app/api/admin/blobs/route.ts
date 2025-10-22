/**
 * GET /api/admin/blobs
 * Returns raw blob records from database with paths (admin/debug only)
 */

import { NextResponse } from "next/server";
import { listFilesWithPaths } from "@/src/server/cas";

export async function GET() {
  try {
    // Return blobs with their filesystem paths
    const blobs = await listFilesWithPaths();
    return NextResponse.json(blobs);
  } catch (error) {
    console.error("Error fetching blobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch blobs" },
      { status: 500 }
    );
  }
}
