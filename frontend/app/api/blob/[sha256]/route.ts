/**
 * GET /api/blob/[sha256]
 * Stream a blob by its SHA-256 hash
 *
 * This is a stub - will be implemented with SQLite + file system
 */

import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sha256: string }> }
) {
  const { sha256 } = await params;

  // TODO: Look up blob in SQLite, stream from file system
  return new NextResponse("Not implemented", { status: 501 });
}
