/**
 * POST /api/scan
 * Triggers a library scan to discover new/changed files
 *
 * This is a stub - will be implemented with file system watching
 */

import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Implement file system scan
  // Scan watched directory, hash files, update SQLite
  return NextResponse.json({ success: true, message: "Scan completed" });
}
