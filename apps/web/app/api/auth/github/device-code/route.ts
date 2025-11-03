/**
 * Proxy for GitHub Device Code flow
 * Desktop/Mobile apps cannot call GitHub directly due to CORS
 */

import { NextRequest, NextResponse } from "next/server";
import {
  corsHeaders,
  handleCorsOptions,
  checkCorsOrigin,
} from "../../../lib/cors";

export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

export async function POST(req: NextRequest) {
  // Check CORS
  const corsError = checkCorsOrigin(req);
  if (corsError) return corsError;

  const origin = req.headers.get("origin") ?? "";

  try {
    const { client_id, scope } = await req.json();

    if (!client_id) {
      return NextResponse.json(
        { error: "client_id is required" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Proxy request to GitHub
    const response = await fetch("https://github.com/login/device/code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id,
        scope: scope || "read:user user:email",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[GitHub Device Code] Failed:", error);
      return NextResponse.json(
        { error: "Failed to request device code from GitHub" },
        { status: response.status, headers: corsHeaders(origin) }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { headers: corsHeaders(origin) });
  } catch (error) {
    console.error("[GitHub Device Code] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
