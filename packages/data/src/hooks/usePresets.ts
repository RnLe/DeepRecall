/**
 * React hooks for Presets using Two-Layer Architecture
 * - Read: Merged data (synced + local) for instant feedback
 * - Write: Local layer (optimistic) with background sync
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Preset, PresetTarget } from "@deeprecall/core";
import * as presetsElectric from "../repos/presets.electric";
import * as presetsLocal from "../repos/presets.local";
import * as presetsMerged from "../repos/presets.merged";
import * as presetsCleanup from "../repos/presets.cleanup";
import { DEFAULT_PRESET_NAMES } from "../repos/presets.default";
import { db } from "../db";
import { useEffect } from "react";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sync Electric data to Dexie presets table
 * Replaces entire table to ensure deletions are reflected
 *
 * CRITICAL: Must handle empty arrays to clear stale data
 */
async function syncElectricToDexie(electricData: Preset[]): Promise<void> {
  await db.transaction("rw", db.presets, async () => {
    // Get current IDs in Dexie
    const currentIds = new Set(await db.presets.toCollection().primaryKeys());

    // Get IDs from Electric
    const electricIds = new Set(electricData.map((p) => p.id));

    // Find IDs to delete (in Dexie but not in Electric)
    const idsToDelete = Array.from(currentIds).filter(
      (id) => !electricIds.has(id)
    );

    // Delete stale records
    if (idsToDelete.length > 0) {
      await db.presets.bulkDelete(idsToDelete);
      console.log(
        `[Electric→Dexie] Deleted ${idsToDelete.length} stale preset(s)`
      );
    }

    // Add/update records from Electric
    if (electricData.length > 0) {
      await db.presets.bulkPut(electricData);
      console.log(`[Electric→Dexie] Synced ${electricData.length} preset(s)`);
    }

    // Log final state
    if (idsToDelete.length === 0 && electricData.length === 0) {
      console.log(`[Electric→Dexie] Presets table cleared (0 rows)`);
    }
  });
}

// ============================================================================
// Sync Hooks (Internal - Called by SyncManager only)
// ============================================================================

/**
 * Internal sync hook: Subscribes to Electric and syncs to Dexie
 * CRITICAL: Must only be called ONCE by SyncManager to prevent race conditions
 *
 * DO NOT call this from components! Use usePresets() instead.
 */
export function usePresetsSync() {
  const electricResult = presetsElectric.usePresets();

  // Sync Electric data to Dexie presets table (for merge layer)
  // CRITICAL: Only sync after receiving fresh data from network
  // Skip stale cached data that hasn't been updated yet
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data !== undefined) {
      // Check if this is stale cached data (before first network update)
      if (!electricResult.isFreshData) {
        return; // Don't sync stale cached data
      }

      // This is fresh data from the network - safe to sync
      syncElectricToDexie(electricResult.data).catch((error) => {
        if (error.name === "DatabaseClosedError") return;
        console.error(
          "[usePresetsSync] Failed to sync Electric data to Dexie:",
          error
        );
      });
    }
  }, [
    electricResult.isLoading,
    electricResult.data,
    electricResult.isFreshData,
  ]);

  // Run cleanup when Electric confirms sync
  useEffect(() => {
    if (
      !electricResult.isLoading &&
      electricResult.data &&
      electricResult.isFreshData
    ) {
      presetsCleanup
        .cleanupSyncedPresets(electricResult.data)
        .catch((error) => {
          if (error.name === "DatabaseClosedError") return;
          console.error("[usePresetsSync] Failed to cleanup:", error);
        });
    }
  }, [
    electricResult.isLoading,
    electricResult.data,
    electricResult.isFreshData,
  ]);

  return null;
}

// ============================================================================
// Query Hooks (Public - Called by components)
// ============================================================================

/**
 * Hook to get all presets (merged: synced + pending local changes)
 * Returns instant feedback with _local metadata for sync status
 *
 * This is a READ-ONLY hook with no side effects.
 * Sync is handled by usePresetsSync() in SyncManager.
 */
export function usePresets() {
  return useQuery({
    queryKey: ["presets", "merged"],
    queryFn: async () => {
      return presetsMerged.getAllMergedPresets();
    },
    staleTime: 0, // Always check for local changes
  });
}

/**
 * Hook to get a single preset by ID (merged)
 * READ-ONLY: No sync side effects (handled by usePresetsSync)
 */
export function usePreset(id: string | undefined) {
  return useQuery({
    queryKey: ["presets", "merged", id],
    queryFn: async () => {
      if (!id) return undefined;
      return presetsMerged.getMergedPreset(id);
    },
    enabled: !!id,
    staleTime: 0,
  });
}

/**
 * Hook to get presets for a specific target entity (merged)
 * READ-ONLY: No sync side effects (handled by usePresetsSync)
 */
export function usePresetsForTarget(targetEntity: PresetTarget) {
  return useQuery({
    queryKey: ["presets", "merged", "target", targetEntity],
    queryFn: async () => {
      return presetsMerged.getMergedPresetsForTarget(targetEntity);
    },
    staleTime: 0,
  });
}

/**
 * Hook to get system presets only (merged)
 * READ-ONLY: No sync side effects (handled by usePresetsSync)
 */
export function useSystemPresets() {
  return useQuery({
    queryKey: ["presets", "merged", "system"],
    queryFn: async () => {
      return presetsMerged.getMergedSystemPresets();
    },
    staleTime: 0,
  });
}

/**
 * Hook to get user presets only (merged)
 * READ-ONLY: No sync side effects (handled by usePresetsSync)
 */
export function useUserPresets() {
  const allPresets = usePresets();

  return {
    ...allPresets,
    data: allPresets.data?.filter((p) => !p.isSystem) ?? [],
  };
}

// ============================================================================
// Mutation Hooks (Local Layer: Optimistic Writes)
// ============================================================================

/**
 * Hook to create a new preset (optimistic)
 * Writes locally first, syncs in background
 */
export function useCreatePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Omit<Preset, "id" | "kind" | "createdAt" | "updatedAt">
    ) => {
      // Write to local layer (instant)
      return presetsLocal.createPresetLocal(data);
    },
    onSuccess: () => {
      // Invalidate merged queries to refetch immediately
      queryClient.invalidateQueries({ queryKey: ["presets", "merged"] });
    },
  });
}

/**
 * Hook to update an existing preset (optimistic)
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
      // Write to local layer (instant)
      return presetsLocal.updatePresetLocal(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets", "merged"] });
    },
  });
}

/**
 * Hook to delete a preset (optimistic)
 */
export function useDeletePreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Write to local layer (instant)
      return presetsLocal.deletePresetLocal(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets", "merged"] });
    },
  });
}

/**
 * Hook to initialize default system presets
 * NON-BLOCKING: Seeds locally first, syncs in background
 */
export function useInitializePresets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Import the initialization function
      const { initializePresets } = await import("../repos/presets.init");
      await initializePresets();
      // No blocking wait - local seeding is instant
    },
    onSuccess: () => {
      // Invalidate merged queries to show new presets immediately
      queryClient.invalidateQueries({ queryKey: ["presets", "merged"] });
      console.log(
        "[useInitializePresets] Preset initialization complete (syncing in background)"
      );
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
