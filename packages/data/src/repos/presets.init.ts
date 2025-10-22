/**
 * Initialize default system presets
 * Called once on app startup to seed system presets
 */

import { db } from "@/src/db/dexie";
import { DEFAULT_PRESETS, DEFAULT_PRESET_NAMES } from "./presets.default";
import { listSystemPresets } from "./presets";
import type { Preset } from "@/src/schema/presets";

/**
 * Initialize system presets if they don't exist
 * Idempotent - safe to call multiple times
 */
export async function initializePresets(): Promise<void> {
  try {
    // Check if system presets already exist
    const existingSystemPresets = await listSystemPresets();
    const existingNames = new Set(existingSystemPresets.map((p) => p.name));

    // Only seed presets that don't exist by name
    const presetsToAdd = DEFAULT_PRESETS.filter(
      (p) => !existingNames.has(p.name)
    );

    if (presetsToAdd.length > 0) {
      console.log(
        `Seeding ${presetsToAdd.length} default system presets... (found ${existingSystemPresets.length}, total ${DEFAULT_PRESETS.length})`
      );
      await db.presets.bulkAdd(presetsToAdd);
      console.log(`✅ Seeded ${presetsToAdd.length} system presets`);
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
 * Reset specific default presets by name
 * Only resets presets with matching names from DEFAULT_PRESET_NAMES
 * Preserves other system and user presets
 *
 * @param names - Array of preset names to reset (e.g., ["Paper", "Textbook"])
 *               If empty/undefined, resets all default presets
 */
export async function resetDefaultPresetsByName(
  names?: readonly string[]
): Promise<{ reset: number; skipped: number }> {
  try {
    const namesToReset =
      names && names.length > 0 ? names : DEFAULT_PRESET_NAMES;
    const nameSet = new Set(namesToReset);

    // Find existing presets with matching names
    const allPresets = await db.presets.toArray();
    const presetsToDelete = allPresets.filter(
      (p) => p.isSystem && nameSet.has(p.name)
    );

    // Delete matching presets
    if (presetsToDelete.length > 0) {
      const idsToDelete = presetsToDelete.map((p) => p.id);
      await db.presets.bulkDelete(idsToDelete);
      console.log(
        `Deleted ${presetsToDelete.length} existing presets:`,
        presetsToDelete.map((p) => p.name)
      );
    }

    // Re-add the default versions
    const defaultsToAdd = DEFAULT_PRESETS.filter((p) => nameSet.has(p.name));
    if (defaultsToAdd.length > 0) {
      await db.presets.bulkAdd(defaultsToAdd);
      console.log(
        `✅ Reset ${defaultsToAdd.length} default presets:`,
        defaultsToAdd.map((p) => p.name)
      );
    }

    const skipped = namesToReset.length - defaultsToAdd.length;
    return { reset: defaultsToAdd.length, skipped };
  } catch (error) {
    console.error("Failed to reset default presets:", error);
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

/**
 * Check which default presets are missing
 */
export async function getMissingDefaultPresets(): Promise<string[]> {
  const existing = await db.presets.toArray();
  const existingNames = new Set(existing.map((p) => p.name));
  return DEFAULT_PRESET_NAMES.filter((name) => !existingNames.has(name));
}

/**
 * Reset a single preset by name to its default configuration
 * Returns true if reset was successful, false if preset name doesn't match any default
 */
export async function resetSinglePresetByName(name: string): Promise<boolean> {
  try {
    // Check if this is a default preset name
    if (!DEFAULT_PRESET_NAMES.includes(name as any)) {
      console.log(`"${name}" is not a default preset name`);
      return false;
    }

    // Find the default definition
    const defaultPreset = DEFAULT_PRESETS.find((p) => p.name === name);
    if (!defaultPreset) {
      console.error(`Default preset "${name}" not found in definitions`);
      return false;
    }

    // Find and delete existing preset with this name
    const existing = await db.presets
      .filter((p) => p.name === name && p.isSystem)
      .toArray();

    if (existing.length > 0) {
      await db.presets.bulkDelete(existing.map((p) => p.id));
      console.log(`Deleted existing "${name}" preset`);
    }

    // Add the default version
    await db.presets.add(defaultPreset);
    console.log(`✅ Reset "${name}" preset to default`);

    return true;
  } catch (error) {
    console.error(`Failed to reset preset "${name}":`, error);
    throw error;
  }
}

/**
 * Get default preset names with their current status
 */
export async function getDefaultPresetsStatus(): Promise<
  Array<{
    name: string;
    exists: boolean;
    isDefault: boolean; // true if name matches exactly
  }>
> {
  const existing = await listSystemPresets();
  const existingMap = new Map(existing.map((p) => [p.name, p]));

  return DEFAULT_PRESET_NAMES.map((name) => ({
    name,
    exists: existingMap.has(name),
    isDefault: existingMap.has(name) && existingMap.get(name)!.isSystem,
  }));
}
