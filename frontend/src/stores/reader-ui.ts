/**
 * Reader UI State Store
 * Manages tab state, active views, and UI layout for the PDF reader
 */

import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";

export type TabType = "pdf-viewer" | "annotation-editor" | "card-generator";
export type LeftSidebarView = "files" | "annotations";

export interface Tab {
  id: string; // Unique tab ID (nanoid)
  type: TabType;
  assetId: string; // Asset SHA-256 or blob ID
  title: string; // Display name
  isDirty?: boolean; // Has unsaved changes
}

export interface ReaderUIState {
  // Tab management
  tabs: Tab[];
  activeTabId: string | null;

  // Sidebar state
  leftSidebarOpen: boolean;
  leftSidebarWidth: number;
  leftSidebarView: LeftSidebarView; // Toggle between files/annotations
  rightSidebarOpen: boolean;
  rightSidebarWidth: number;

  // Actions
  openTab: (assetId: string, title: string, type?: TabType) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;
  closeAllTabs: () => void;

  // Sidebar actions
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftSidebarWidth: (width: number) => void;
  setRightSidebarWidth: (width: number) => void;
  setLeftSidebarView: (view: LeftSidebarView) => void;

  // Getters
  getActiveTab: () => Tab | null;
  hasTab: (assetId: string) => boolean;
}

export const useReaderUI = create<ReaderUIState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        tabs: [],
        activeTabId: null,
        leftSidebarOpen: true,
        leftSidebarWidth: 280,
        leftSidebarView: "files" as LeftSidebarView,
        rightSidebarOpen: false,
        rightSidebarWidth: 400, // Wider for annotation editor

        // Tab actions
        openTab: (
          assetId: string,
          title: string,
          type: TabType = "pdf-viewer"
        ) => {
          const state = get();

          // Check if tab already exists
          const existingTab = state.tabs.find((t) => t.assetId === assetId);
          if (existingTab) {
            set({ activeTabId: existingTab.id });
            return;
          }

          // Create new tab
          const newTab: Tab = {
            id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            type,
            assetId,
            title,
            isDirty: false,
          };

          set({
            tabs: [...state.tabs, newTab],
            activeTabId: newTab.id,
          });
        },

        closeTab: (tabId: string) => {
          const state = get();
          const tabIndex = state.tabs.findIndex((t) => t.id === tabId);

          if (tabIndex === -1) return;

          const newTabs = state.tabs.filter((t) => t.id !== tabId);

          // Determine new active tab
          let newActiveTabId = state.activeTabId;
          if (state.activeTabId === tabId) {
            // If closing active tab, switch to adjacent tab
            if (newTabs.length > 0) {
              const newIndex = Math.min(tabIndex, newTabs.length - 1);
              newActiveTabId = newTabs[newIndex].id;
            } else {
              newActiveTabId = null;
            }
          }

          set({
            tabs: newTabs,
            activeTabId: newActiveTabId,
          });
        },

        setActiveTab: (tabId: string) => {
          const state = get();
          const tab = state.tabs.find((t) => t.id === tabId);
          if (tab) {
            set({ activeTabId: tabId });
          }
        },

        updateTab: (tabId: string, updates: Partial<Tab>) => {
          set((state) => ({
            tabs: state.tabs.map((tab) =>
              tab.id === tabId ? { ...tab, ...updates } : tab
            ),
          }));
        },

        closeAllTabs: () => {
          set({ tabs: [], activeTabId: null });
        },

        // Sidebar actions
        toggleLeftSidebar: () => {
          set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen }));
        },

        toggleRightSidebar: () => {
          set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen }));
        },

        setLeftSidebarWidth: (width: number) => {
          set({ leftSidebarWidth: Math.max(200, Math.min(600, width)) });
        },

        setRightSidebarWidth: (width: number) => {
          set({ rightSidebarWidth: Math.max(200, Math.min(600, width)) });
        },

        setLeftSidebarView: (view: LeftSidebarView) => {
          set({ leftSidebarView: view });
        },

        // Getters
        getActiveTab: () => {
          const state = get();
          return state.tabs.find((t) => t.id === state.activeTabId) || null;
        },

        hasTab: (assetId: string) => {
          const state = get();
          return state.tabs.some((t) => t.assetId === assetId);
        },
      }),
      {
        name: "reader-ui-storage",
        partialize: (state) => ({
          leftSidebarOpen: state.leftSidebarOpen,
          leftSidebarWidth: state.leftSidebarWidth,
          leftSidebarView: state.leftSidebarView,
          rightSidebarOpen: state.rightSidebarOpen,
          rightSidebarWidth: state.rightSidebarWidth,
          // Don't persist tabs - they should be opened fresh each session
        }),
      }
    )
  )
);
