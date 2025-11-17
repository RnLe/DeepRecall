/**
 * Shared CORS configuration for API routes
 * Allows mobile (Capacitor), web (browser), and local development origins
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Allowed origins for CORS (mobile + web + desktop + local dev)
 */
export const ALLOW_ORIGINS = new Set([
  "capacitor://localhost", // Mobile iOS (Capacitor)
  "ionic://localhost", // Mobile iOS (Ionic alternative)
  "tauri://localhost", // Desktop (Tauri) - production build
  "http://tauri.localhost", // Desktop (Tauri) - alternative scheme
  "http://localhost", // Generic localhost
  "http://localhost:3000", // Web dev (Next.js)
  "http://localhost:5173", // Mobile dev (Vite dev server)
  "https://deeprecall-production.up.railway.app", // Production web
  // Add your custom domain when you have one
]);

const LOCALHOST_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(?::\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i,
];

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) {
    return true;
  }

  if (ALLOW_ORIGINS.has(origin)) {
    return true;
  }

  return LOCALHOST_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

/**
 * Generate CORS headers for the given origin
 */
export function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Max-Age": "86400", // 24 hours
    "Access-Control-Expose-Headers": [
      "electric-handle",
      "electric-offset",
      "electric-schema",
      "content-type",
    ].join(", "),
  };
}

/**
 * Handle OPTIONS request for CORS preflight
 * Returns 204 if origin is allowed, 403 otherwise
 */
export function handleCorsOptions(req: NextRequest): NextResponse {
  const origin = req.headers.get("origin") ?? "";
  if (!isOriginAllowed(origin)) {
    return new NextResponse("Origin not allowed", { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

/**
 * Check if origin is allowed and return appropriate response or null
 * Use this at the start of POST/GET handlers
 *
 * @returns NextResponse with 403 if origin not allowed, null if allowed
 *
 * @example
 * ```ts
 * export async function POST(req: NextRequest) {
 *   const corsError = checkCorsOrigin(req);
 *   if (corsError) return corsError;
 *
 *   // ... your handler logic
 *
 *   return NextResponse.json(data, {
 *     headers: corsHeaders(req.headers.get("origin") ?? "")
 *   });
 * }
 * ```
 */
export function checkCorsOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  if (!isOriginAllowed(origin ?? null)) {
    return new NextResponse("Origin not allowed", { status: 403 });
  }
  return null;
}

/**
 * Add CORS headers to an existing response
 *
 * @example
 * ```ts
 * const response = NextResponse.json(data);
 * return addCorsHeaders(response, req);
 * ```
 */
export function addCorsHeaders(
  response: NextResponse | Response,
  req: NextRequest
): NextResponse | Response {
  const origin = req.headers.get("origin") ?? "";
  if (origin && isOriginAllowed(origin)) {
    const headers = corsHeaders(origin);
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }
  return response;
}
