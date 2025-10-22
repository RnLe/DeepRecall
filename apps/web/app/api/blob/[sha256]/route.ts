/**
 * GET /api/blob/[sha256]
 * Stream a blob by its SHA-256 hash
 */

import { NextResponse } from "next/server";
import { getBlobByHash, getPathForHash } from "@/src/server/cas";
import { readFile } from "fs/promises";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sha256: string }> }
) {
  try {
    const { sha256 } = await params;

    // Look up blob metadata
    const blob = await getBlobByHash(sha256);
    if (!blob) {
      return NextResponse.json({ error: "Blob not found" }, { status: 404 });
    }

    // Get file path
    const filePath = await getPathForHash(sha256);
    if (!filePath) {
      return NextResponse.json(
        { error: "File path not found" },
        { status: 404 }
      );
    }

    // Read and stream the file
    const buffer = await readFile(filePath);

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": blob.mime,
        "Content-Length": blob.size.toString(),
        "Cache-Control": "public, max-age=31536000, immutable", // Content-addressed, never changes
      },
    });
  } catch (error) {
    console.error("Error serving blob:", error);
    return NextResponse.json(
      { error: "Failed to serve blob" },
      { status: 500 }
    );
  }
}
