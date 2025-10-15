/**
 * POST /api/scan
 * Triggers a library scan to discover new/changed files
 */

import { NextResponse } from "next/server";
import { scanLibrary } from "@/src/server/cas";

export async function POST() {
  try {
    const result = await scanLibrary();
    return NextResponse.json({
      success: true,
      message: "Scan completed",
      ...result,
    });
  } catch (error) {
    console.error("Error scanning library:", error);
    return NextResponse.json(
      { error: "Failed to scan library" },
      { status: 500 }
    );
  }
}
