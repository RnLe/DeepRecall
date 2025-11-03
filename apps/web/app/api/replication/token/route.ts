/**
 * Electric Replication Token Endpoint
 *
 * Desktop/mobile apps exchange their app JWT for a short-lived
 * Electric replication token. The token contains userId + deviceId
 * which the Electric proxy uses to set app.user_id GUC for RLS.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAppJWT, signElectricToken } from "@/src/auth/jwt";
import {
  handleCorsOptions,
  checkCorsOrigin,
  corsHeaders,
} from "@/app/api/lib/cors";

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

export async function POST(req: NextRequest) {
  // Check CORS origin
  const corsError = checkCorsOrigin(req);
  if (corsError) return corsError;

  try {
    // Extract app JWT from Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401, headers: corsHeaders(req.headers.get("origin") ?? "") }
      );
    }

    const app_jwt = authHeader.replace("Bearer ", "");

    // Verify app JWT
    const claims = await verifyAppJWT(app_jwt);

    // Generate short-lived Electric replication token (15min)
    const electric_token = await signElectricToken(
      {
        userId: claims.userId,
        deviceId: claims.deviceId,
      },
      { expiresIn: "15m" }
    );

    return NextResponse.json(
      {
        electric_token,
        expires_in: 15 * 60, // seconds
      },
      {
        headers: corsHeaders(req.headers.get("origin") ?? ""),
      }
    );
  } catch (error) {
    console.error("Electric token generation error:", error);

    // Check if JWT verification failed
    if (error instanceof Error && error.message.includes("expired")) {
      return NextResponse.json(
        { error: "JWT expired" },
        { status: 401, headers: corsHeaders(req.headers.get("origin") ?? "") }
      );
    }

    return NextResponse.json(
      { error: "Token generation failed" },
      {
        status: 500,
        headers: corsHeaders(req.headers.get("origin") ?? ""),
      }
    );
  }
}
