/**
 * Annotation UI store (Zustand slice)
 * Ephemeral state: tool selection, active page, etc.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type AnnotationTool = "pan" | "highlight" | "rectangle" | "note";

interface AnnotationUIState {
  tool: AnnotationTool;
  activePage: number;
  selectedAnnotationId: string | null;
  
  // Actions
  setTool: (tool: AnnotationTool) => void;
  setActivePage: (page: number) => void;
  selectAnnotation: (id: string | null) => void;
}

export const useAnnotationUI = create<AnnotationUIState>()(
  subscribeWithSelector((set) => ({
    tool: "pan",
    activePage: 1,
    selectedAnnotationId: null,
    
    setTool: (tool) => set({ tool }),
    setActivePage: (page) => set({ activePage: page }),
    selectAnnotation: (id) => set({ selectedAnnotationId: id }),
  }))
);
