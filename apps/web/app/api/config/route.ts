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
import { logger } from "@deeprecall/telemetry";

function parseBooleanFlag(value?: string) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

export async function GET() {
  // Debug: Log environment variables to diagnose Railway configuration
  const nextPublicVars = Object.keys(process.env).filter((key) =>
    key.startsWith("NEXT_PUBLIC")
  );

  logger.debug("server.api", "Runtime config requested", {
    nodeEnv: process.env.NODE_ENV,
    hasElectricUrl: !!process.env.NEXT_PUBLIC_ELECTRIC_URL,
    hasElectricSourceId: !!process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_ID,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    postgresHost: process.env.POSTGRES_HOST,
    nextPublicVarCount: nextPublicVars.length,
  });

  // IMPORTANT: NEXT_PUBLIC_* vars are baked into the bundle at build time
  // For Railway, we need to read them without the NEXT_PUBLIC_ prefix on the server
  // But keep NEXT_PUBLIC_ for client-side builds
  // IMPORTANT: Always use the proxy endpoint, never fallback to direct Electric Cloud URL
  const electricUrl =
    process.env.NEXT_PUBLIC_ELECTRIC_URL ||
    process.env.ELECTRIC_URL ||
    "/api/electric/v1/shape"; // Relative path to use our proxy

  const electricSourceId =
    process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_ID ||
    process.env.ELECTRIC_SOURCE_ID ||
    "";

  const electricSecret =
    process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET ||
    process.env.ELECTRIC_SOURCE_SECRET ||
    "";

  const enableFolderSourcesSync = parseBooleanFlag(
    process.env.NEXT_PUBLIC_ENABLE_FOLDER_SOURCES_SYNC ??
      process.env.ENABLE_FOLDER_SOURCES_SYNC
  );

  const config = {
    electricUrl,
    electricSourceId,
    electricSecret,
    enableFolderSourcesSync,
  };

  logger.info("server.api", "Serving runtime config", {
    electricUrl: config.electricUrl,
    hasSourceId: !!config.electricSourceId,
    hasSecret: !!config.electricSecret,
    folderSourcesSyncEnabled: config.enableFolderSourcesSync,
  });

  return NextResponse.json(config);
}
