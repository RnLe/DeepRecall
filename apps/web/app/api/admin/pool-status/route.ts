/**
 * GET /api/admin/pool-status
 * Debug endpoint to check Postgres pool status
 *
 * POST /api/admin/pool-status
 * Reset the Postgres pool (emergency)
 */

import { NextResponse } from "next/server";
import { getPostgresPool, resetPostgresPool } from "@/app/api/lib/postgres";

export async function GET() {
  const pool = getPostgresPool();

  return NextResponse.json({
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    max: (pool as any).options?.max || "unknown",
  });
}

export async function POST() {
  try {
    await resetPostgresPool();
    return NextResponse.json({
      success: true,
      message: "Pool reset successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
