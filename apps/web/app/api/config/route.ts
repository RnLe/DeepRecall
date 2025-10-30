/**
 * Runtime Configuration API
 *
 * Provides environment variables to the client at runtime.
 * This solves the issue where Railway variables aren't available during build.
 *
 * GET /api/config
 * Returns: { electricUrl, electricSourceId, electricSecret }
 */

import { NextResponse } from "next/server";

export async function GET() {
  const config = {
    electricUrl:
      process.env.NEXT_PUBLIC_ELECTRIC_URL || "http://localhost:5133",
    electricSourceId: process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_ID || "",
    electricSecret: process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET || "",
  };

  console.log("[Config API] Serving runtime config:", {
    electricUrl: config.electricUrl,
    hasSourceId: !!config.electricSourceId,
    hasSecret: !!config.electricSecret,
  });

  return NextResponse.json(config);
}
