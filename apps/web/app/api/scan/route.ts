/**
 * POST /api/scan
 * Triggers a library scan to discover new/changed files
 */

import { NextResponse } from "next/server";
import { scanLibrary } from "@/src/server/cas";
import { logger } from "@deeprecall/telemetry";

export async function POST() {
  try {
    const result = await scanLibrary();
    logger.info("cas", "Library scan completed", result);
    return NextResponse.json({
      success: true,
      message: "Scan completed",
      ...result,
    });
  } catch (error) {
    logger.error("cas", "Library scan failed", {
      error: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Failed to scan library" },
      { status: 500 }
    );
  }
}
