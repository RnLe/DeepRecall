/**
 * Sync initialization - Electric + FlushWorker
 * Call this once on app startup (client-side only)
 */

import { initElectric } from "@deeprecall/data/electric";
import { initFlushWorker } from "@deeprecall/data/writeBuffer";
import { logger } from "@deeprecall/telemetry";

let initialized = false;

/**
 * Initialize sync services
 * Must be called client-side (not during SSR)
 */
export function initSync() {
  if (initialized) {
    logger.info("sync.electric", "Sync already initialized");
    return;
  }

  if (typeof window === "undefined") {
    logger.warn("sync.electric", "Cannot initialize sync on server");
    return;
  }

  logger.info("sync.electric", "Initializing Electric and FlushWorker");

  try {
    // Initialize Electric for read-path (shapes)
    const electricUrl =
      process.env.NEXT_PUBLIC_ELECTRIC_URL || "http://localhost:5133";
    initElectric({
      url: electricUrl,
      // TODO: Add auth token when implementing authentication
    });
    logger.info("sync.electric", "Electric initialized", { electricUrl });

    // Initialize FlushWorker for write-path
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || window.location.origin;
    const flushWorker = initFlushWorker({
      apiBase,
      batchSize: 10,
      // TODO: Add auth token when implementing authentication
    });

    // Start the flush worker (checks every 5 seconds)
    flushWorker.start(5000);
    logger.info("sync.writeBuffer", "FlushWorker started", {
      endpoint: `${apiBase}/api/writes/batch`,
    });

    initialized = true;
    logger.info("sync.electric", "Sync initialization complete");
  } catch (error) {
    logger.error("sync.electric", "Sync initialization failed", { error });
    throw error;
  }
}

/**
 * Check if sync is initialized
 */
export function isSyncInitialized(): boolean {
  return initialized;
}
