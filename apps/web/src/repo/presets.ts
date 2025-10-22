/**
 * Presets repository
 * CRUD operations for form template presets
 */

import { db } from "@deeprecall/data/db";
import {
  PresetSchema,
  type Preset,
  type PresetTarget,
} from "@deeprecall/core/schemas/presets";
import { v4 as uuidv4 } from "uuid";

/**
 * Create a new preset
 */
export async function createPreset(
  data: Omit<Preset, "id" | "kind" | "createdAt" | "updatedAt">
): Promise<Preset> {
  const preset: Preset = PresetSchema.parse({
    ...data,
    id: uuidv4(),
    kind: "preset",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await db.presets.add(preset);
  return preset;
}

/**
 * Get preset by ID
 */
export async function getPreset(id: string): Promise<Preset | undefined> {
  return db.presets.get(id);
}

/**
 * List all presets
 */
export async function listPresets(): Promise<Preset[]> {
  return db.presets.toArray();
}

/**
 * List presets for specific target entity
 */
export async function listPresetsForTarget(
  targetEntity: PresetTarget
): Promise<Preset[]> {
  return db.presets.where("targetEntity").equals(targetEntity).toArray();
}

/**
 * List system presets only
 */
export async function listSystemPresets(): Promise<Preset[]> {
  return db.presets.where("isSystem").equals(1).toArray();
}

/**
 * List user presets only (non-system)
 */
export async function listUserPresets(): Promise<Preset[]> {
  return db.presets.where("isSystem").equals(0).toArray();
}

/**
 * Update preset
 */
export async function updatePreset(
  id: string,
  updates: Partial<Omit<Preset, "id" | "kind" | "createdAt">>
): Promise<void> {
  const existing = await db.presets.get(id);
  if (!existing) {
    throw new Error(`Preset ${id} not found`);
  }

  // Don't allow updating system presets
  if (existing.isSystem) {
    throw new Error("Cannot update system preset");
  }

  await db.presets.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Delete preset
 */
export async function deletePreset(id: string): Promise<void> {
  const existing = await db.presets.get(id);
  if (!existing) {
    throw new Error(`Preset ${id} not found`);
  }

  // Allow deleting all presets (including system/default ones)
  await db.presets.delete(id);
}

/**
 * Search presets by name
 */
export async function searchPresets(query: string): Promise<Preset[]> {
  const lowerQuery = query.toLowerCase();
  return db.presets
    .filter((preset) => preset.name.toLowerCase().includes(lowerQuery))
    .toArray();
}
