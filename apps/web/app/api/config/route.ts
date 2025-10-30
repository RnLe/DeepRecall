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
  // Debug: Log all environment variables to see what Railway is providing
  console.log("[Config API] Environment check:");
  console.log("  NODE_ENV:", process.env.NODE_ENV);
  console.log(
    "  NEXT_PUBLIC_ELECTRIC_URL:",
    process.env.NEXT_PUBLIC_ELECTRIC_URL
  );
  console.log(
    "  NEXT_PUBLIC_ELECTRIC_SOURCE_ID:",
    process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_ID
  );
  console.log("  DATABASE_URL exists:", !!process.env.DATABASE_URL);
  console.log("  POSTGRES_HOST:", process.env.POSTGRES_HOST);

  // Check all env vars starting with NEXT_PUBLIC
  const nextPublicVars = Object.keys(process.env).filter((key) =>
    key.startsWith("NEXT_PUBLIC")
  );
  console.log("  All NEXT_PUBLIC_* vars:", nextPublicVars);

  // IMPORTANT: NEXT_PUBLIC_* vars are baked into the bundle at build time
  // For Railway, we need to read them without the NEXT_PUBLIC_ prefix on the server
  // But keep NEXT_PUBLIC_ for client-side builds
  const electricUrl =
    process.env.NEXT_PUBLIC_ELECTRIC_URL ||
    process.env.ELECTRIC_URL ||
    "http://localhost:5133";

  const electricSourceId =
    process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_ID ||
    process.env.ELECTRIC_SOURCE_ID ||
    "";

  const electricSecret =
    process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET ||
    process.env.ELECTRIC_SOURCE_SECRET ||
    "";

  const config = {
    electricUrl,
    electricSourceId,
    electricSecret,
  };

  console.log("[Config API] Serving runtime config:", {
    electricUrl: config.electricUrl,
    hasSourceId: !!config.electricSourceId,
    hasSecret: !!config.electricSecret,
  });

  return NextResponse.json(config);
}
