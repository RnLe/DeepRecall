/**
 * Health check endpoint
 * Tests database connectivity and returns basic stats
 */

import { NextResponse } from "next/server";
import { db } from "@/src/server/db";
import { blobs, paths } from "@/src/server/schema";
import { sql } from "drizzle-orm";
import { logger } from "@deeprecall/telemetry";

export const runtime = "nodejs"; // Ensure Node.js runtime (not Edge)
export const dynamic = "force-dynamic"; // no caching

export async function GET() {
  try {
    // Count blobs and paths
    const blobCountResult = db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(blobs)
      .get();
    const pathCountResult = db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(paths)
      .get();

    return NextResponse.json({
      ok: true,
      db: "connected",
      blobs: blobCountResult?.count ?? 0,
      paths: pathCountResult?.count ?? 0,
    });
  } catch (error) {
    logger.error("server.api", "Health check failed", {
      error: (error as Error).message,
    });
    return NextResponse.json(
      { ok: false, error: "Database connection failed" },
      { status: 500 }
    );
  }
}
