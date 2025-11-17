import { NextRequest, NextResponse } from "next/server";
import { logger } from "@deeprecall/telemetry";
import {
  addCorsHeaders,
  checkCorsOrigin,
  handleCorsOptions,
} from "@/app/api/lib/cors";

const DEFAULT_ELECTRIC_BASE = "https://api.electric-sql.cloud";

const electricBaseUrl = (
  process.env.ELECTRIC_PROXY_BASE_URL || DEFAULT_ELECTRIC_BASE
).replace(/\/$/, "");

function buildUpstreamUrl(req: NextRequest): URL {
  const upstream = new URL(`${electricBaseUrl}/v1/shape`);
  const incomingParams = req.nextUrl.searchParams;

  incomingParams.forEach((value, key) => {
    upstream.searchParams.append(key, value);
  });

  const sourceId =
    process.env.ELECTRIC_SOURCE_ID ||
    process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_ID;
  const secret =
    process.env.ELECTRIC_SOURCE_SECRET ||
    process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET;

  if (!upstream.searchParams.has("source_id") && sourceId) {
    upstream.searchParams.set("source_id", sourceId);
  }

  if (!upstream.searchParams.has("secret") && secret) {
    upstream.searchParams.set("secret", secret);
  }

  return upstream;
}

export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // Disable edge runtime to prevent response mangling

export async function GET(req: NextRequest) {
  const corsError = checkCorsOrigin(req);
  if (corsError) return corsError;

  const upstreamUrl = buildUpstreamUrl(req);

  try {
    logger.info("sync.electric", "Proxying Electric shape request", {
      table: upstreamUrl.searchParams.get("table"),
      where: upstreamUrl.searchParams.get("where"),
      offset: upstreamUrl.searchParams.get("offset"),
      handle: upstreamUrl.searchParams.get("handle"),
      upstreamUrl: upstreamUrl.toString(),
    });

    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "DeepRecall-Electric-Proxy/1.0",
    };

    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      headers.Authorization = authHeader;
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    logger.debug("sync.electric", "Upstream Electric response received", {
      status: upstreamResponse.status,
      hasBody: !!upstreamResponse.body,
      contentType: upstreamResponse.headers.get("content-type"),
    });

    if (!upstreamResponse.body) {
      throw new Error("Upstream response has no body");
    }

    const responseHeaders = new Headers();
    for (const [key, value] of upstreamResponse.headers.entries()) {
      if (key.startsWith("access-control")) continue;
      responseHeaders.set(key, value);
    }

    // Use native Response for raw streaming passthrough (avoid NextResponse buffering)
    const response = new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });

    return addCorsHeaders(response, req);
  } catch (error) {
    logger.error("sync.electric", "Electric proxy request failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    const response = NextResponse.json(
      {
        error: "Electric proxy request failed",
      },
      { status: 502 }
    );

    return addCorsHeaders(response, req);
  }
}
