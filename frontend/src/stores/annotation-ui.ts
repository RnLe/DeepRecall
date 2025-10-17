/**
 * Annotation Store - Ephemeral UI state for annotation tool
 * Following DeepRecall mental model: Zustand for UI only, not durable data
 *
 * This store manages:
 * - Active annotation tool (pan, rectangle, highlight)
 * - Selection in progress (temporary geometry before save)
 * - UI state (color picker, note editor visibility)
 *
 * Durable annotations live in Dexie (via annotationRepo)
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { NormalizedRect } from "../schema/annotation";

export type AnnotationTool = "pan" | "rectangle" | "highlight" | "note";

interface SelectionState {
  // Rectangle tool: in-progress rectangles
  rectangles: NormalizedRect[];

  // Highlight tool: in-progress text ranges
  textRanges: Array<{
    text: string;
    rects: NormalizedRect[];
  }>;

  // Common: which page is being annotated
  page: number | null;

  // Common: annotation metadata being edited
  color: string;
  title: string;
  notes: string;
  tags: string[];
}

interface AnnotationUIState {
  // Active tool
  tool: AnnotationTool;
  setTool: (tool: AnnotationTool) => void;

  // Selection in progress
  selection: SelectionState;
  setSelection: (selection: Partial<SelectionState>) => void;
  clearSelection: () => void;

  // UI visibility
  noteEditorOpen: boolean;
  setNoteEditorOpen: (open: boolean) => void;

  colorPickerOpen: boolean;
  setColorPickerOpen: (open: boolean) => void;

  // Active page (for single-page annotation context)
  activePage: number;
  setActivePage: (page: number) => void;

  // Selected annotation (for editing)
  selectedAnnotationId: string | null;
  setSelectedAnnotationId: (id: string | null) => void;

  // Navigation (for scrolling to annotation pages)
  targetPage: number | null;
  targetYOffset: number | null; // Normalized Y coordinate (0-1) for precise scrolling
  navigateToPage: (page: number, yOffset?: number) => void;
  clearTargetPage: () => void;
}

const DEFAULT_COLOR = "#fbbf24"; // Amber-400

export const useAnnotationUI = create<AnnotationUIState>()(
  subscribeWithSelector((set) => ({
    // Tool state
    tool: "pan",
    setTool: (tool) => set({ tool }),

    // Selection state
    selection: {
      rectangles: [],
      textRanges: [],
      page: null,
      color: DEFAULT_COLOR,
      title: "",
      notes: "",
      tags: [],
    },
    setSelection: (partial) =>
      set((state) => ({
        selection: { ...state.selection, ...partial },
      })),
    clearSelection: () =>
      set({
        selection: {
          rectangles: [],
          textRanges: [],
          page: null,
          color: DEFAULT_COLOR,
          title: "",
          notes: "",
          tags: [],
        },
      }),

    // UI visibility
    noteEditorOpen: false,
    setNoteEditorOpen: (open) => set({ noteEditorOpen: open }),

    colorPickerOpen: false,
    setColorPickerOpen: (open) => set({ colorPickerOpen: open }),

    // Page state
    activePage: 1,
    setActivePage: (page) => set({ activePage: page }),

    // Selection
    selectedAnnotationId: null,
    setSelectedAnnotationId: (id) => set({ selectedAnnotationId: id }),

    // Navigation
    targetPage: null,
    targetYOffset: null,
    navigateToPage: (page, yOffset) =>
      set({ targetPage: page, targetYOffset: yOffset ?? null }),
    clearTargetPage: () => set({ targetPage: null, targetYOffset: null }),
  }))
);

/**
 * Helper: Check if there's an active selection
 */
export function hasActiveSelection(state: AnnotationUIState): boolean {
  return (
    state.selection.rectangles.length > 0 ||
    state.selection.textRanges.length > 0
  );
}

/**
 * Helper: Get selection bounding box (for UI positioning)
 */
export function getSelectionBounds(
  selection: SelectionState
): NormalizedRect | null {
  const allRects = [
    ...selection.rectangles,
    ...selection.textRanges.flatMap((r) => r.rects),
  ];

  if (allRects.length === 0) return null;

  let minX = 1,
    minY = 1,
    maxX = 0,
    maxY = 0;

  for (const rect of allRects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
