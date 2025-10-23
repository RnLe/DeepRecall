/**
 * Repository for Preset entities (Electric + WriteBuffer version)
 * Read-path: Electric shapes syncing from Postgres
 * Write-path: WriteBuffer queue → /api/writes/batch → Postgres → Electric
 */

import type { Preset, PresetTarget } from "@deeprecall/core";
import { PresetSchema } from "@deeprecall/core";
import { useShape } from "../electric";
import { createWriteBuffer } from "../writeBuffer";

/**
 * React hook to get all Presets (live-synced from Postgres)
 */
export function usePresets() {
  return useShape<Preset>({
    table: "presets",
  });
}

/**
 * React hook to get a single Preset by ID
 */
export function usePreset(id: string | undefined) {
  return useShape<Preset>({
    table: "presets",
    where: id ? `id = '${id}'` : undefined,
  });
}

/**
 * React hook to get Presets for a specific target entity
 */
export function usePresetsForTarget(targetEntity: PresetTarget) {
  return useShape<Preset>({
    table: "presets",
    where: `target_entity = '${targetEntity}'`,
  });
}

/**
 * React hook to get system presets only
 */
export function useSystemPresets() {
  return useShape<Preset>({
    table: "presets",
    where: "is_system = true",
  });
}

/**
 * React hook to get user presets only
 */
export function useUserPresets() {
  return useShape<Preset>({
    table: "presets",
    where: "is_system = false",
  });
}

/**
 * Get write buffer instance
 */
const buffer = createWriteBuffer();

/**
 * Create a new Preset (optimistic)
 */
export async function createPreset(
  data: Omit<Preset, "id" | "kind" | "createdAt" | "updatedAt">
): Promise<Preset> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const preset: Preset = {
    ...data,
    id,
    kind: "preset",
    createdAt: now,
    updatedAt: now,
  };

  // Validate before enqueuing
  const validated = PresetSchema.parse(preset);

  // Enqueue write to buffer
  await buffer.enqueue({
    table: "presets",
    op: "insert",
    payload: validated,
  });

  console.log(`[PresetsRepo] Created preset ${id} (enqueued)`);
  return validated;
}

/**
 * Update an existing Preset
 */
export async function updatePreset(
  id: string,
  updates: Partial<Omit<Preset, "id" | "kind" | "createdAt">>
): Promise<void> {
  const payload = {
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };

  await buffer.enqueue({
    table: "presets",
    op: "update",
    payload,
  });

  console.log(`[PresetsRepo] Updated preset ${id} (enqueued)`);
}

/**
 * Delete a Preset
 */
export async function deletePreset(id: string): Promise<void> {
  await buffer.enqueue({
    table: "presets",
    op: "delete",
    payload: { id },
  });

  console.log(`[PresetsRepo] Deleted preset ${id} (enqueued)`);
}
