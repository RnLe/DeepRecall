/**
 * TemplateLibrary Wrapper (Next.js)
 *
 * Implements TemplateLibraryOperations for the Next.js platform using Electric
 */

"use client";

import type { Preset } from "@deeprecall/core";
import {
  TemplateLibrary as TemplateLibraryUI,
  TemplateLibraryOperations,
} from "@deeprecall/ui";
import {
  usePresets,
  useCreatePreset,
  useUpdatePreset,
  useDeletePreset,
  useInitializePresets,
  useMissingDefaultPresets,
  useResetSinglePreset,
} from "@deeprecall/data/hooks";
import { useTemplateLibraryUI } from "@deeprecall/data/stores";
import { DEFAULT_PRESET_NAMES } from "@deeprecall/data/repos/presets.default";
import { getPresetColor } from "@/src/utils/presets";
import { MessageModal } from "./MessageModal";
import { InputModal } from "./InputModal";
import { TemplateEditorModal } from "./TemplateEditorModal";

export function TemplateLibrary() {
  // UI state from Zustand store
  const isOpen = useTemplateLibraryUI((state) => state.isOpen);
  const closeModal = useTemplateLibraryUI((state) => state.closeModal);
  const searchQuery = useTemplateLibraryUI((state) => state.searchQuery);
  const setSearchQuery = useTemplateLibraryUI((state) => state.setSearchQuery);
  const selectedTarget = useTemplateLibraryUI((state) => state.selectedTarget);
  const setSelectedTarget = useTemplateLibraryUI(
    (state) => state.setSelectedTarget
  );
  const isSelectMode = useTemplateLibraryUI((state) => state.isSelectMode);
  const enableSelectMode = useTemplateLibraryUI(
    (state) => state.enableSelectMode
  );
  const disableSelectMode = useTemplateLibraryUI(
    (state) => state.disableSelectMode
  );
  const selectedIds = useTemplateLibraryUI((state) => state.selectedIds);
  const toggleSelection = useTemplateLibraryUI(
    (state) => state.toggleSelection
  );
  const selectAllVisible = useTemplateLibraryUI(
    (state) => state.selectAllVisible
  );
  const clearSelection = useTemplateLibraryUI((state) => state.clearSelection);
  const isSelected = useTemplateLibraryUI((state) => state.isSelected);

  // Data from Electric
  const { data: presets = [] } = usePresets();
  const createPreset = useCreatePreset();
  const updatePreset = useUpdatePreset();
  const deletePreset = useDeletePreset();
  const initializePresets = useInitializePresets();
  const missingDefaults = useMissingDefaultPresets();
  const resetSinglePreset = useResetSinglePreset();

  // Build operations
  const operations: TemplateLibraryOperations = {
    getPresets: () => presets || [],
    getMissingDefaults: () => missingDefaults,
    getDefaultPresetNames: () => Array.from(DEFAULT_PRESET_NAMES),
    getPresetColor,

    createPreset: async (
      preset: Omit<Preset, "id" | "kind" | "createdAt" | "updatedAt">
    ) => {
      await createPreset.mutateAsync(preset);
    },

    updatePreset: async (id: string, updates: Partial<Preset>) => {
      await updatePreset.mutateAsync({ id, updates });
    },

    deletePreset: async (id: string) => {
      await deletePreset.mutateAsync(id);
    },

    initializePresets: async () => {
      await initializePresets.mutateAsync();
    },

    resetSinglePreset: async (name) => {
      return await resetSinglePreset.mutateAsync(name);
    },

    MessageModal,
    InputModal,
    TemplateEditorModal,
  };

  // Build UI state and actions
  const uiState = {
    isOpen,
    searchQuery,
    selectedTarget,
    isSelectMode,
    selectedIds,
  };

  const uiActions = {
    closeModal,
    setSearchQuery,
    setSelectedTarget,
    enableSelectMode,
    disableSelectMode,
    toggleSelection,
    selectAllVisible,
    clearSelection,
    isSelected,
  };

  return (
    <TemplateLibraryUI
      uiState={uiState}
      uiActions={uiActions}
      operations={operations}
    />
  );
}
