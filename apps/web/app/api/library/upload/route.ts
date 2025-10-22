/**
 * POST /api/library/upload
 * Upload a file and return blob metadata
 * Client will create Asset in Dexie
 */

import { NextRequest, NextResponse } from "next/server";
import { storeBlob } from "@/src/server/cas";
import { z } from "zod";

const UploadMetadataSchema = z.object({
  role: z.string().default("notes"),
  purpose: z.string().optional(),
  workId: z.string().uuid().optional(),
  annotationId: z.string().optional(),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
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

    // Store in CAS with organized structure
    const {
      hash,
      path: filePath,
      size,
    } = await storeBlob(buffer, file.name, metadata.role);

    console.log(
      `Uploaded: ${file.name} → ${hash.slice(0, 16)}... (${metadata.role})`
    );

    // Return blob metadata (client will create Asset in Dexie)
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
    console.error("Upload failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
