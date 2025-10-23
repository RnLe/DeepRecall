/**
 * React hooks for Presets using Electric + WriteBuffer
 * Platform-agnostic data access with real-time sync
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Preset, PresetTarget } from "@deeprecall/core";
import * as presetsElectric from "../repos/presets.electric";
import { DEFAULT_PRESET_NAMES } from "../repos/presets.default";

// ============================================================================
// Query Hooks (Electric-based, live-synced)
// ============================================================================

/**
 * Hook to get all presets (live-synced from Postgres via Electric)
 */
export function usePresets() {
  return presetsElectric.usePresets();
}

/**
 * Hook to get a single preset by ID (live-synced)
 */
export function usePreset(id: string | undefined) {
  const result = presetsElectric.usePreset(id);

  // Transform to return single preset or undefined (not array)
  return {
    ...result,
    data: result.data?.[0],
  };
}

/**
 * Hook to get presets for a specific target entity (live-synced)
 */
export function usePresetsForTarget(targetEntity: PresetTarget) {
  return presetsElectric.usePresetsForTarget(targetEntity);
}

/**
 * Hook to get system presets only (live-synced)
 */
export function useSystemPresets() {
  return presetsElectric.useSystemPresets();
}

/**
 * Hook to get user presets only (live-synced)
 */
export function useUserPresets() {
  return presetsElectric.useUserPresets();
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to create a new preset
 */
export function useCreatePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Omit<Preset, "id" | "kind" | "createdAt" | "updatedAt">
    ) => {
      return presetsElectric.createPreset(data);
    },
    onSuccess: () => {
      // Electric shapes will auto-update, but invalidate for consistency
      queryClient.invalidateQueries({ queryKey: ["presets"] });
    },
  });
}

/**
 * Hook to update an existing preset
 */
export function useUpdatePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Preset, "id" | "kind" | "createdAt">>;
    }) => {
      return presetsElectric.updatePreset(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets"] });
    },
  });
}

/**
 * Hook to delete a preset
 */
export function useDeletePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return presetsElectric.deletePreset(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets"] });
    },
  });
}

/**
 * Hook to initialize default system presets
 * Checks for missing defaults and creates them
 */
export function useInitializePresets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Import the initialization function
      const { initializePresets } = await import("../repos/presets.init");
      return initializePresets();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets"] });
    },
  });
}

/**
 * Hook to get list of missing default presets
 * Returns array of preset names that should exist but don't
 */
export function useMissingDefaultPresets() {
  const { data: allPresets = [] } = usePresets();

  const existingNames = new Set(
    allPresets.filter((p) => p.isSystem).map((p) => p.name)
  );

  const missing = DEFAULT_PRESET_NAMES.filter(
    (name: string) => !existingNames.has(name)
  );

  return missing;
}

/**
 * Hook to reset a single preset to its default configuration
 */
export function useResetSinglePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { resetSinglePresetByName } = await import("../repos/presets.init");
      return resetSinglePresetByName(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets"] });
    },
  });
}

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Hook to get work presets grouped by system/user
 */
export function useWorkPresets() {
  const { data: presets = [] } = usePresetsForTarget("work");

  return {
    system: presets.filter((p) => p.isSystem),
    user: presets.filter((p) => !p.isSystem),
  };
}

/**
 * Hook to get version presets grouped by system/user
 */
export function useVersionPresets() {
  const { data: presets = [] } = usePresetsForTarget("version");

  return {
    system: presets.filter((p) => p.isSystem),
    user: presets.filter((p) => !p.isSystem),
  };
}

/**
 * Hook to get asset presets grouped by system/user
 */
export function useAssetPresets() {
  const { data: presets = [] } = usePresetsForTarget("asset");

  return {
    system: presets.filter((p) => p.isSystem),
    user: presets.filter((p) => !p.isSystem),
  };
}
