/**
 * POST /api/library/upload
 * Upload a file and return blob metadata
 * Asset creation happens client-side via coordinateSingleBlob()
 */

import { NextRequest, NextResponse } from "next/server";
import { storeBlob } from "@/src/server/cas";
import { z } from "zod";
import { logger } from "@deeprecall/telemetry";

const UploadMetadataSchema = z.object({
  role: z.string().default("notes"),
  purpose: z.string().optional(),
  workId: z.string().uuid().optional(),
  annotationId: z.string().optional(),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  deviceId: z.string().optional(), // Client's unique device ID
});

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = [
  "text/markdown",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 413 }
      );
    }

    // Normalize MIME type (check extension for markdown files)
    let mimeType = file.type;
    if (
      (file.type === "application/octet-stream" || !file.type) &&
      file.name.endsWith(".md")
    ) {
      mimeType = "text/markdown";
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Parse metadata
    const metadataJson = formData.get("metadata") as string;
    const metadata = metadataJson
      ? UploadMetadataSchema.parse(JSON.parse(metadataJson))
      : { role: "notes" };

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get deviceId from metadata or generate a fallback
    // In production, deviceId should always be provided by client
    const deviceId = metadata.deviceId || "web-upload-fallback";

    // Store in CAS with organized structure
    const {
      hash,
      path: filePath,
      size,
    } = await storeBlob(buffer, file.name, metadata.role, deviceId);

    logger.info("blob.upload", "Blob uploaded successfully", {
      filename: file.name,
      hash: hash.slice(0, 16),
      role: metadata.role,
      size,
      mime: mimeType,
    });

    // Return blob metadata
    // Asset creation happens client-side via coordinateSingleBlob()
    return NextResponse.json({
      blob: {
        sha256: hash,
        size,
        mime: mimeType,
        filename: file.name,
      },
      metadata,
    });
  } catch (error) {
    logger.error("blob.upload", "Blob upload failed", {
      error: (error as Error).message,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
