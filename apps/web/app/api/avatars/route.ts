/**
 * Avatar Upload API
 *
 * Handles saving avatar images to disk:
 * - Original (compressed) version
 * - Display (100x100px) version
 * - Stores with meaningful filenames based on author ID
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import {
  handleCorsOptions,
  checkCorsOrigin,
  addCorsHeaders,
} from "@/app/api/lib/cors";

// Avatar storage directory (relative to project root)
const AVATAR_DIR = path.join(process.cwd(), "data", "avatars");

// Ensure avatar directory exists
async function ensureAvatarDir() {
  if (!existsSync(AVATAR_DIR)) {
    await mkdir(AVATAR_DIR, { recursive: true });
  }
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

/**
 * POST /api/avatars
 * Upload a new avatar
 */
export async function POST(request: NextRequest) {
  // Check CORS origin
  const corsError = checkCorsOrigin(request);
  if (corsError) return corsError;
  try {
    await ensureAvatarDir();

    const formData = await request.formData();
    const authorId = formData.get("authorId") as string;
    const originalFile = formData.get("original") as File;
    const displayFile = formData.get("display") as File;
    const cropRegion = formData.get("cropRegion") as string;

    if (!authorId || !originalFile || !displayFile || !cropRegion) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Generate filenames
    const timestamp = Date.now();
    const originalFilename = `${authorId}_original_${timestamp}.jpg`;
    const displayFilename = `${authorId}_display_${timestamp}.jpg`;

    // Save files
    const originalPath = path.join(AVATAR_DIR, originalFilename);
    const displayPath = path.join(AVATAR_DIR, displayFilename);

    const originalBuffer = Buffer.from(await originalFile.arrayBuffer());
    const displayBuffer = Buffer.from(await displayFile.arrayBuffer());

    await writeFile(originalPath, originalBuffer);
    await writeFile(displayPath, displayBuffer);

    const response = NextResponse.json({
      success: true,
      paths: {
        original: `/api/avatars/${originalFilename}`,
        display: `/api/avatars/${displayFilename}`,
      },
      cropRegion: JSON.parse(cropRegion),
    });
    return addCorsHeaders(response, request);
  } catch (error) {
    console.error("Failed to upload avatar:", error);
    const response = NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
}

/**
 * DELETE /api/avatars?path=...
 * Delete an avatar file
 */
export async function DELETE(request: NextRequest) {
  // Check CORS origin
  const corsError = checkCorsOrigin(request);
  if (corsError) return corsError;
  try {
    const url = new URL(request.url);
    const filepath = url.searchParams.get("path");

    if (!filepath) {
      return NextResponse.json(
        { error: "Missing path parameter" },
        { status: 400 }
      );
    }

    // Extract filename from path
    const filename = filepath.split("/").pop();
    if (!filename) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const fullPath = path.join(AVATAR_DIR, filename);

    // Check if file exists
    if (existsSync(fullPath)) {
      await unlink(fullPath);
    }

    const response = NextResponse.json({ success: true });
    return addCorsHeaders(response, request);
  } catch (error) {
    console.error("Failed to delete avatar:", error);
    const response = NextResponse.json(
      { error: "Failed to delete avatar" },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
}
