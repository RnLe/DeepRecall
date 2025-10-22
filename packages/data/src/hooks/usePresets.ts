/**
 * React Query hooks for Presets
 * Live queries with mutations for preset management
 */

import { useLiveQuery } from "dexie-react-hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as presetRepo from "@deeprecall/data/repos/presets";
import {
  initializePresets,
  resetSystemPresets,
  resetDefaultPresetsByName,
  getMissingDefaultPresets,
  resetSinglePresetByName,
  getDefaultPresetsStatus,
} from "@deeprecall/data/repos/presets.init";
import type { Preset, PresetTarget } from "@deeprecall/core/schemas/presets";

// ============================================================================
// Query Hooks (Live)
// ============================================================================

/**
 * Hook to get all presets (live query)
 */
export function usePresets() {
  return useLiveQuery(() => presetRepo.listPresets(), []);
}

/**
 * Hook to get presets for a specific target entity (live query)
 */
export function usePresetsForTarget(targetEntity: PresetTarget) {
  return useLiveQuery(
    () => presetRepo.listPresetsForTarget(targetEntity),
    [targetEntity]
  );
}

/**
 * Hook to get a single preset (live query)
 */
export function usePreset(id: string | undefined) {
  return useLiveQuery(() => (id ? presetRepo.getPreset(id) : undefined), [id]);
}

/**
 * Hook to get system presets only (live query)
 */
export function useSystemPresets() {
  return useLiveQuery(() => presetRepo.listSystemPresets(), []);
}

/**
 * Hook to get user presets only (live query)
 */
export function useUserPresets() {
  return useLiveQuery(() => presetRepo.listUserPresets(), []);
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
      return presetRepo.createPreset(data);
    },
    onSuccess: () => {
      // Invalidate relevant queries (live queries will auto-update)
      queryClient.invalidateQueries({ queryKey: ["presets"] });
    },
  });
}

/**
 * Hook to update a preset
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
      return presetRepo.updatePreset(id, updates);
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
      return presetRepo.deletePreset(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets"] });
    },
  });
}

/**
 * Hook to search presets
 */
export function useSearchPresets(query: string) {
  return useLiveQuery(() => presetRepo.searchPresets(query), [query]);
}

// ============================================================================
// Initialization Hook
// ============================================================================

/**
 * Hook to initialize default system presets
 * Call this once on app startup
 */
export function useInitializePresets() {
  return useMutation({
    mutationFn: async () => {
      return initializePresets();
    },
  });
}

/**
 * Hook to reset all system presets to defaults
 */
export function useResetSystemPresets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return resetSystemPresets();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets"] });
    },
  });
}

/**
 * Hook to reset specific default presets by name
 */
export function useResetDefaultPresets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (names?: readonly string[]) => {
      return resetDefaultPresetsByName(names);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets"] });
    },
  });
}

/**
 * Hook to check which default presets are missing
 */
export function useMissingDefaultPresets() {
  return useLiveQuery(() => getMissingDefaultPresets(), []);
}

/**
 * Hook to reset a single preset by name
 */
export function useResetSinglePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      return resetSinglePresetByName(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets"] });
    },
  });
}

/**
 * Hook to get status of all default presets
 */
export function useDefaultPresetsStatus() {
  return useLiveQuery(() => getDefaultPresetsStatus(), []);
}

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Hook to get work presets grouped by system/user
 */
export function useWorkPresets() {
  const presets = useLiveQuery(
    () => presetRepo.listPresetsForTarget("work"),
    []
  );

  if (!presets) return { system: [], user: [] };

  return {
    system: presets.filter((p) => p.isSystem),
    user: presets.filter((p) => !p.isSystem),
  };
}

/**
 * Hook to get version presets grouped by system/user
 */
export function useVersionPresets() {
  const presets = useLiveQuery(
    () => presetRepo.listPresetsForTarget("version"),
    []
  );

  if (!presets) return { system: [], user: [] };

  return {
    system: presets.filter((p) => p.isSystem),
    user: presets.filter((p) => !p.isSystem),
  };
}

/**
 * Hook to get asset presets grouped by system/user
 */
export function useAssetPresets() {
  const presets = useLiveQuery(
    () => presetRepo.listPresetsForTarget("asset"),
    []
  );

  if (!presets) return { system: [], user: [] };

  return {
    system: presets.filter((p) => p.isSystem),
    user: presets.filter((p) => !p.isSystem),
  };
}

/**
 * Hook to check if a preset is a system preset
 */
export function useIsSystemPreset(id: string | undefined) {
  const preset = usePreset(id);
  return preset?.isSystem ?? false;
}
