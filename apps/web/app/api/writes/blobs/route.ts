/**
 * POST /api/writes/blobs
 * Server-side route to create blob coordination entries in Electric
 *
 * This is called by storeBlob() to create blobs_meta and device_blobs
 * entries after successfully storing a blob in the local CAS.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const BlobCoordinationSchema = z.object({
  sha256: z.string().min(64).max(64),
  size: z.number().int().min(0),
  mime: z.string(),
  filename: z.string().nullable(),
  deviceId: z.string(),
  localPath: z.string().nullable().optional(),

  // Optional extracted metadata
  pageCount: z.number().int().optional(),
  imageWidth: z.number().int().optional(),
  imageHeight: z.number().int().optional(),
  lineCount: z.number().int().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = BlobCoordinationSchema.parse(body);

    // Import server-safe functions (write directly to Postgres)
    const { createBlobMetaServer, markBlobAvailableServer } = await import(
      "@deeprecall/data/repos/blobs.server"
    );

    // Create blobs_meta entry directly in Postgres
    await createBlobMetaServer({
      sha256: data.sha256,
      size: data.size,
      mime: data.mime,
      filename: data.filename,
      pageCount: data.pageCount,
      imageWidth: data.imageWidth,
      imageHeight: data.imageHeight,
      lineCount: data.lineCount,
    });

    // Mark blob as available on this device directly in Postgres
    await markBlobAvailableServer(
      data.sha256,
      data.deviceId,
      data.localPath || null,
      "healthy"
    );

    console.log(
      `[BlobCoordination] Created Electric entries for ${data.sha256.slice(0, 16)}... on device ${data.deviceId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "[BlobCoordination] Failed to create Electric entries:",
      error
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create blob coordination",
      },
      { status: 500 }
    );
  }
}
