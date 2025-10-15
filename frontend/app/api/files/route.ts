/**
 * GET /api/files
 * Returns list of all files in the CAS
 *
 * This is a stub - will be implemented with SQLite backend
 */

import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Query SQLite database for files
  // For now, return empty array
  return NextResponse.json([]);
}
