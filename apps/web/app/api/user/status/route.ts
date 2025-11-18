/**
 * GET /api/user/status
 *
 * Returns user's account status to determine if this is first sign-in or returning user.
 * Used by guest→user upgrade decision logic.
 *
 * Strategy: Check linked_identities table
 * - First sign-in → No entry in linked_identities (NEW account)
 * - Returning user → Entry exists in linked_identities (EXISTING account)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/lib/auth-helpers";
import { getPostgresPool } from "@/app/api/lib/postgres";
import {
  addCorsHeaders,
  checkCorsOrigin,
  handleCorsOptions,
} from "@/app/api/lib/cors";
import { logger } from "@deeprecall/telemetry";

export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

export async function GET(req: NextRequest) {
  const corsError = checkCorsOrigin(req);
  if (corsError) {
    return corsError;
  }

  let userContext;
  try {
    userContext = await requireAuth(req);
  } catch (error) {
    const response = NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
    return addCorsHeaders(response, req);
  }

  try {
    const userId = userContext.userId;
    const pool = getPostgresPool();

    // Check if user exists in linked_identities (indicates previous sign-in)
    const identityResult = await pool.query(
      "SELECT COUNT(*) as count FROM linked_identities WHERE user_id = $1",
      [userId]
    );

    const identityCount = parseInt(identityResult.rows[0].count);

    // NEW user: No linked identity yet (this is first sign-in)
    // EXISTING user: Has linked identity (returning user)
    const isNew = identityCount === 0;

    // Also get data counts for debugging
    const worksResult = await pool.query(
      "SELECT COUNT(*) as count FROM works WHERE owner_id = $1",
      [userId]
    );

    const assetsResult = await pool.query(
      "SELECT COUNT(*) as count FROM assets WHERE owner_id = $1",
      [userId]
    );

    const annotationsResult = await pool.query(
      "SELECT COUNT(*) as count FROM annotations WHERE owner_id = $1",
      [userId]
    );

    const worksCount = parseInt(worksResult.rows[0].count);
    const assetsCount = parseInt(assetsResult.rows[0].count);
    const annotationsCount = parseInt(annotationsResult.rows[0].count);

    const status = {
      identityCount,
      isNew,
      // Data counts for debugging
      worksCount,
      assetsCount,
      annotationsCount,
    };

    logger.info("auth", "User status checked", {
      userIdPrefix: userId.slice(0, 8),
      ...status,
    });

    const response = NextResponse.json(status);
    return addCorsHeaders(response, req);
  } catch (error) {
    logger.error("auth", "Failed to check user status", {
      error: error instanceof Error ? error.message : String(error),
    });

    const response = NextResponse.json(
      { error: "Failed to check account status" },
      { status: 500 }
    );
    return addCorsHeaders(response, req);
  }
}
