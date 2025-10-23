/**
 * Initialize default system presets
 * Called once on app startup to seed system presets
 * UPDATED: Uses local layer for instant seeding (no blocking)
 */

import { DEFAULT_PRESETS, DEFAULT_PRESET_NAMES } from "./presets.default";
import type { Preset } from "@deeprecall/core";
import { createWriteBuffer } from "../writeBuffer";
import { db } from "../db";
import * as presetsLocal from "./presets.local";

/**
 * Get write buffer instance
 */
const buffer = createWriteBuffer();

/**
 * Initialize system presets if they don't exist
 * NON-BLOCKING: Seeds locally first, syncs in background
 * Idempotent - safe to call multiple times
 */
export async function initializePresets(): Promise<void> {
  try {
    // Check existing presets from Dexie (both synced + local)
    const [syncedPresets, localChanges] = await Promise.all([
      db.presets.toArray(),
      db.presets_local.toArray(),
    ]);

    // Combine to get full picture (excluding pending deletes)
    const existingNames = new Set<string>();
    const deletedIds = new Set<string>();

    // Track pending deletes
    localChanges
      .filter((c) => c._op === "delete")
      .forEach((c) => deletedIds.add(c.id));

    // Add synced preset names (excluding pending deletes)
    syncedPresets
      .filter((p) => p.isSystem && !deletedIds.has(p.id))
      .forEach((p) => existingNames.add(p.name));

    // Add pending local inserts (only inserts, not deletes)
    localChanges
      .filter((c) => c._op === "insert" && c.data?.isSystem)
      .forEach((c) => c.data && existingNames.add(c.data.name));

    // Only seed presets that don't exist by name
    const presetsToAdd = DEFAULT_PRESETS.filter(
      (p) => !existingNames.has(p.name)
    );

    if (presetsToAdd.length > 0) {
      console.log(
        `[Init] Seeding ${presetsToAdd.length} system presets locally...`
      );

      // Write to local layer (instant, non-blocking)
      for (const preset of presetsToAdd) {
        await presetsLocal.createPresetLocal(preset);
      }

      console.log(
        `✅ [Init] Seeded ${presetsToAdd.length} system presets (syncing in background)`
      );
    } else {
      console.log(
        `✓ [Init] System presets already initialized (${existingNames.size} found)`
      );
    }
  } catch (error) {
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
    // Query current system presets from Dexie
    const systemPresets = await db.presets
      .where("isSystem")
      .equals(1)
      .toArray();

    // Delete existing system presets using local layer
    for (const preset of systemPresets) {
      await presetsLocal.deletePresetLocal(preset.id);
    }

    console.log(`Deleted ${systemPresets.length} system presets (local)`);

    // Re-seed defaults using local layer
    for (const preset of DEFAULT_PRESETS) {
      await presetsLocal.createPresetLocal(preset);
    }

    console.log(
      `✅ Reset ${DEFAULT_PRESETS.length} system presets (syncing in background)`
    );
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

    // Find existing presets with matching names from Dexie
    const allPresets = await db.presets.toArray();
    const presetsToDelete = allPresets.filter(
      (p: Preset) => p.isSystem && nameSet.has(p.name)
    );

    // Delete matching presets using local layer
    if (presetsToDelete.length > 0) {
      for (const preset of presetsToDelete) {
        await presetsLocal.deletePresetLocal(preset.id);
      }
      console.log(
        `Deleted ${presetsToDelete.length} existing presets:`,
        presetsToDelete.map((p: Preset) => p.name)
      );
    }

    // Re-add the default versions using local layer
    const defaultsToAdd = DEFAULT_PRESETS.filter((p) => nameSet.has(p.name));
    if (defaultsToAdd.length > 0) {
      for (const preset of defaultsToAdd) {
        await presetsLocal.createPresetLocal(preset);
      }
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
  const presets = await db.presets.toArray();
  const systemPresets = presets.filter((p: Preset) => p.isSystem);
  return systemPresets.length > 0;
}

/**
 * Check which default presets are missing
 */
export async function getMissingDefaultPresets(): Promise<string[]> {
  const existing = await db.presets.toArray();
  const existingNames = new Set(existing.map((p: Preset) => p.name));
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
    const allPresets = await db.presets.toArray();
    const existing = allPresets.filter(
      (p: Preset) => p.name === name && p.isSystem
    );

    if (existing.length > 0) {
      for (const preset of existing) {
        await presetsLocal.deletePresetLocal(preset.id);
      }
      console.log(`Deleted existing "${name}" preset`);
    }

    // Add the default version using local layer
    await presetsLocal.createPresetLocal(defaultPreset);
    console.log(`✅ Reset "${name}" preset to default (enqueued)`);

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
  const allPresets = await db.presets.toArray();
  const systemPresets = allPresets.filter((p: Preset) => p.isSystem);
  const existingMap = new Map(systemPresets.map((p: Preset) => [p.name, p]));

  return DEFAULT_PRESET_NAMES.map((name) => ({
    name,
    exists: existingMap.has(name),
    isDefault: existingMap.has(name) && existingMap.get(name)!.isSystem,
  }));
}
