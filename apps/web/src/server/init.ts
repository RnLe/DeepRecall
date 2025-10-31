/**
 * Server initialization
 * Import this in instrumentation.ts to run at Next.js startup
 */

import { mkdir } from "fs/promises";
import path from "path";
import { logger } from "@deeprecall/telemetry";

let initialized = false;

/**
 * Ensure required directories exist
 */
async function ensureDirectories() {
  // Store data in apps/web/data (works for both local dev and Railway deployment)
  const dataPath = process.env.DATA_PATH || path.join(process.cwd(), "data");
  const libraryPath =
    process.env.LIBRARY_PATH || path.join(dataPath, "library");

  try {
    await mkdir(libraryPath, { recursive: true });
    await mkdir(dataPath, { recursive: true });
    logger.info("server.api", "Directories initialized", {
      dataPath,
      libraryPath,
    });
  } catch (error) {
    logger.error("server.api", "Failed to create directories", {
      error: error instanceof Error ? error.message : String(error),
      dataPath,
      libraryPath,
    });
    throw error;
  }
}

export async function initializeServer() {
  if (initialized) return;

  logger.info("server.api", "Initializing DeepRecall server");

  // Ensure directories exist
  await ensureDirectories();

  // Lazy import to avoid loading native modules during Edge instrumentation
  const { initDB } = await import("./db");
  initDB();

  initialized = true;
  logger.info("server.api", "Server ready");
}
