/**
 * GET /api/files
 * Returns list of all files in the CAS
 */

import { NextResponse } from "next/server";
import { listFiles } from "@/src/server/cas";

export async function GET() {
  try {
    const blobs = await listFiles();

    // Transform database format (hash) to API format (sha256)
    const files = blobs.map((blob) => ({
      sha256: blob.hash,
      size: blob.size,
      mime: blob.mime,
      mtime_ms: blob.mtime_ms,
      created_ms: blob.created_ms,
      filename: blob.filename,
    }));

    return NextResponse.json(files);
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}
