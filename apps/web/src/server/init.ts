/**
 * Server initialization
 * Import this in instrumentation.ts to run at Next.js startup
 */

import { mkdir } from "fs/promises";
import path from "path";

let initialized = false;

/**
 * Ensure required directories exist
 */
async function ensureDirectories() {
  const dataPath = path.join(process.cwd(), "data");
  const libraryPath =
    process.env.LIBRARY_PATH || path.join(dataPath, "library");

  try {
    await mkdir(libraryPath, { recursive: true });
    await mkdir(dataPath, { recursive: true });
    console.log("Directories initialized");
  } catch (error) {
    console.error("Failed to create directories:", error);
    throw error;
  }
}

export async function initializeServer() {
  if (initialized) return;

  console.log("Initializing DeepRecall server...");

  // Ensure directories exist
  await ensureDirectories();

  // Lazy import to avoid loading native modules during Edge instrumentation
  const { initDB } = await import("./db");
  initDB();

  initialized = true;
  console.log("Server ready");
}
