/**
 * Admin Utility: Reset Presets
 * Run this once to clean up duplicate presets
 */

import { db } from "@deeprecall/data/db";
import { resetSystemPresets } from "@deeprecall/data/repos";
import { logger } from "@deeprecall/telemetry";

export async function cleanupDuplicatePresets() {
  logger.info("ui", "Starting preset cleanup");

  try {
    // Delete ALL presets (system and user)
    const allPresets = await db.presets.toArray();
    logger.info("ui", "Found presets to cleanup", {
      count: allPresets.length,
    });

    await db.presets.clear();
    logger.info("ui", "Cleared all presets");

    // Re-seed system presets
    await resetSystemPresets();
    logger.info("ui", "Re-seeded system presets");

    const finalCount = await db.presets.count();
    logger.info("ui", "Preset cleanup complete", {
      finalCount,
    });
  } catch (error) {
    logger.error("ui", "Preset cleanup failed", { error });
  }
}

// Export for console access
if (typeof window !== "undefined") {
  (window as any).cleanupDuplicatePresets = cleanupDuplicatePresets;
}
