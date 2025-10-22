/**
 * PDF Viewer UI store (Zustand slice)
 * Ephemeral state: zoom, scroll, sidebar visibility, etc.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ViewerUIState {
  zoom: number;
  sidebarOpen: boolean;
  
  // Actions
  setZoom: (zoom: number) => void;
  toggleSidebar: () => void;
}

export const useViewerUI = create<ViewerUIState>()(
  persist(
    (set) => ({
      zoom: 1.0,
      sidebarOpen: true,
      
      setZoom: (zoom) => set({ zoom }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: "viewer-ui-storage",
      partialize: (state) => ({ sidebarOpen: state.sidebarOpen }), // Only persist sidebar state
    }
  )
);
