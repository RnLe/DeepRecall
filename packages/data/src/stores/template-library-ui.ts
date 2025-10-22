/**
 * Template Library UI Store
 * Zustand store for ephemeral UI state (modal, filters, selection)
 * Does NOT store template data (that's in Dexie)
 */

import { create } from "zustand";
import type { PresetTarget } from "@deeprecall/core";

interface TemplateLibraryUIState {
  // Modal state
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;

  // Filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTarget: PresetTarget | "all";
  setSelectedTarget: (target: PresetTarget | "all") => void;

  // Selection mode (for multi-delete)
  isSelectMode: boolean;
  enableSelectMode: () => void;
  disableSelectMode: () => void;

  // Selection state
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  selectAllVisible: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;

  // Editing state
  editingPresetId: string | null;
  setEditingPresetId: (id: string | null) => void;

  // Reset all filters and selections
  resetFilters: () => void;
}

export const useTemplateLibraryUI = create<TemplateLibraryUIState>(
  (set, get) => ({
    // Modal state
    isOpen: false,
    openModal: () => set({ isOpen: true }),
    closeModal: () => {
      set({ isOpen: false });
      // Reset filters and selections when closing
      get().resetFilters();
      get().clearSelection();
    },

    // Filters
    searchQuery: "",
    setSearchQuery: (query) => set({ searchQuery: query }),
    selectedTarget: "all",
    setSelectedTarget: (target) => set({ selectedTarget: target }),

    // Selection mode
    isSelectMode: false,
    enableSelectMode: () => set({ isSelectMode: true }),
    disableSelectMode: () => {
      set({ isSelectMode: false });
      get().clearSelection();
    },

    // Selection
    selectedIds: new Set(),
    toggleSelection: (id) =>
      set((state) => {
        const newSet = new Set(state.selectedIds);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return { selectedIds: newSet };
      }),
    selectAll: (ids) => set({ selectedIds: new Set(ids) }),
    selectAllVisible: (ids) => set({ selectedIds: new Set(ids) }),
    clearSelection: () => set({ selectedIds: new Set() }),
    isSelected: (id) => get().selectedIds.has(id),

    // Editing
    editingPresetId: null,
    setEditingPresetId: (id) => set({ editingPresetId: id }),

    // Reset
    resetFilters: () =>
      set({
        searchQuery: "",
        selectedTarget: "all",
      }),
  })
);
