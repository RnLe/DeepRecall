/**
 * Avatar Serve API
 *
 * Serves avatar images from disk
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const AVATAR_DIR = path.join(process.cwd(), "data", "avatars");

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    const filepath = path.join(AVATAR_DIR, filename);

    // Security: ensure the path is within AVATAR_DIR
    const normalizedPath = path.normalize(filepath);
    if (!normalizedPath.startsWith(AVATAR_DIR)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 403 });
    }

    // Check if file exists
    if (!existsSync(filepath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Read and serve file
    const buffer = await readFile(filepath);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Failed to serve avatar:", error);
    return NextResponse.json(
      { error: "Failed to serve avatar" },
      { status: 500 }
    );
  }
}
