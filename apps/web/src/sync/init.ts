/**
 * Sync initialization - Electric + FlushWorker
 * Call this once on app startup (client-side only)
 */

import { initElectric } from "@deeprecall/data/electric";
import { initFlushWorker } from "@deeprecall/data/writeBuffer";

let initialized = false;

/**
 * Initialize sync services
 * Must be called client-side (not during SSR)
 */
export function initSync() {
  if (initialized) {
    console.log("[Sync] Already initialized");
    return;
  }

  if (typeof window === "undefined") {
    console.warn("[Sync] Cannot initialize on server");
    return;
  }

  console.log("[Sync] Initializing Electric and FlushWorker...");

  try {
    // Initialize Electric for read-path (shapes)
    const electricUrl =
      process.env.NEXT_PUBLIC_ELECTRIC_URL || "http://localhost:5133";
    initElectric({
      url: electricUrl,
      // TODO: Add auth token when implementing authentication
    });
    console.log(`[Sync] Electric initialized (${electricUrl})`);

    // Initialize FlushWorker for write-path
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || window.location.origin;
    const flushWorker = initFlushWorker({
      apiBase,
      batchSize: 10,
      // TODO: Add auth token when implementing authentication
    });

    // Start the flush worker (checks every 5 seconds)
    flushWorker.start(5000);
    console.log(`[Sync] FlushWorker started (${apiBase}/api/writes/batch)`);

    initialized = true;
    console.log("[Sync] ✓ Initialization complete");
  } catch (error) {
    console.error("[Sync] Initialization failed:", error);
    throw error;
  }
}

/**
 * Check if sync is initialized
 */
export function isSyncInitialized(): boolean {
  return initialized;
}
