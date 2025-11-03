/**
 * Proxy for GitHub Device Token polling
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
    const { client_id, device_code, grant_type } = await req.json();

    if (!client_id || !device_code) {
      return NextResponse.json(
        { error: "client_id and device_code are required" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // Proxy request to GitHub
    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id,
          device_code,
          grant_type:
            grant_type || "urn:ietf:params:oauth:grant-type:device_code",
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[GitHub Token Poll] Failed:", error);
      return NextResponse.json(
        { error: "Failed to poll GitHub for token" },
        { status: response.status, headers: corsHeaders(origin) }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { headers: corsHeaders(origin) });
  } catch (error) {
    console.error("[GitHub Token Poll] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
