/**
 * Initialize default system presets
 * Called once on app startup to seed system presets
 */

import { db } from "@/src/db/dexie";
import { DEFAULT_PRESETS } from "./presets.default";
import { listSystemPresets } from "./presets";

/**
 * Initialize system presets if they don't exist
 * Idempotent - safe to call multiple times
 */
export async function initializePresets(): Promise<void> {
  try {
    // Check if system presets already exist
    const existingSystemPresets = await listSystemPresets();

    // Only seed if we have fewer than expected (4 default presets)
    if (existingSystemPresets.length < DEFAULT_PRESETS.length) {
      console.log(
        `Seeding default system presets... (found ${existingSystemPresets.length}, need ${DEFAULT_PRESETS.length})`
      );

      // Get IDs of existing presets to avoid duplicates
      const existingIds = new Set(existingSystemPresets.map((p) => p.id));
      const presetsToAdd = DEFAULT_PRESETS.filter(
        (p) => !existingIds.has(p.id)
      );

      if (presetsToAdd.length > 0) {
        await db.presets.bulkAdd(presetsToAdd);
        console.log(`✅ Seeded ${presetsToAdd.length} system presets`);
      }
    } else {
      console.log(
        `✓ System presets already initialized (${existingSystemPresets.length} found)`
      );
    }
  } catch (error) {
    // Ignore duplicate key errors (presets already exist)
    if (error instanceof Error && error.name === "ConstraintError") {
      console.log("✓ System presets already exist (duplicate key)");
      return;
    }
    console.error("Failed to initialize presets:", error);
    throw error;
  }
}

/**
 * Reset system presets to defaults
 * WARNING: Deletes all existing system presets and re-seeds
 * User presets are preserved
 */
export async function resetSystemPresets(): Promise<void> {
  try {
    // Delete existing system presets
    const systemPresets = await listSystemPresets();
    const systemIds = systemPresets.map((p) => p.id);
    await db.presets.bulkDelete(systemIds);

    console.log(`Deleted ${systemIds.length} system presets`);

    // Re-seed defaults
    await db.presets.bulkAdd(DEFAULT_PRESETS);

    console.log(`✅ Reset ${DEFAULT_PRESETS.length} system presets`);
  } catch (error) {
    console.error("Failed to reset system presets:", error);
    throw error;
  }
}

/**
 * Check if presets have been initialized
 */
export async function arePresetsInitialized(): Promise<boolean> {
  const systemPresets = await listSystemPresets();
  return systemPresets.length > 0;
}
