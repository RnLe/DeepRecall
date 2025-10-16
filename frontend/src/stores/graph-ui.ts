/**
 * Graph UI Store
 *
 * Manages UI state for the data graph visualization:
 * - Node selection (single and multi-select with Shift+Click)
 * - Type-based selection (clicking stat cards)
 * - Zoom/pan transform state
 * - Hover state
 * - Drag state
 *
 * MENTAL MODEL:
 * This is pure UI state - no data persistence, just visual interaction state.
 * The actual graph data (nodes, links) comes from Dexie via useLiveQuery.
 */

import { create } from "zustand";

export interface GraphNode {
  id: string;
  label: string;
  type: "work" | "version" | "asset" | "activity" | "collection";
  data?: any;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface ZoomTransform {
  x: number;
  y: number;
  k: number;
}

interface GraphUIState {
  // Selection state
  selectedNodeIds: Set<string>;
  isMultiSelectMode: boolean; // true when shift is held

  // Interaction state
  hoveredNode: GraphNode | null;
  draggedNodes: GraphNode[]; // All nodes being dragged (selected nodes)
  isPanning: boolean;
  panStart: { x: number; y: number };

  // Transform state
  zoomTransform: ZoomTransform;

  // Actions - Selection
  selectNode: (nodeId: string, isMultiSelect: boolean) => void;
  setSelection: (selectedIds: Set<string>) => void;
  selectNodesByType: (type: GraphNode["type"]) => void;
  clearSelection: () => void;
  isNodeSelected: (nodeId: string) => boolean;

  // Actions - Interaction
  setHoveredNode: (node: GraphNode | null) => void;
  startDragging: (nodes: GraphNode[]) => void;
  stopDragging: () => void;
  startPanning: (startPos: { x: number; y: number }) => void;
  stopPanning: () => void;

  // Actions - Transform
  setZoomTransform: (
    transform: ZoomTransform | ((prev: ZoomTransform) => ZoomTransform)
  ) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  zoomTowardsCursor: (
    mousePos: { x: number; y: number },
    delta: number,
    containerRect: DOMRect
  ) => void;
  updatePan: (clientPos: { x: number; y: number }) => void;

  // Actions - Multi-select mode
  setMultiSelectMode: (enabled: boolean) => void;
}

export const useGraphUI = create<GraphUIState>((set, get) => ({
  // Initial state
  selectedNodeIds: new Set(),
  isMultiSelectMode: false,
  hoveredNode: null,
  draggedNodes: [],
  isPanning: false,
  panStart: { x: 0, y: 0 },
  zoomTransform: { x: 0, y: 0, k: 1 },

  // Selection actions
  selectNode: (nodeId, isMultiSelect) => {
    set((state) => {
      const newSelected = new Set(state.selectedNodeIds);

      if (isMultiSelect) {
        // Toggle selection
        if (newSelected.has(nodeId)) {
          newSelected.delete(nodeId);
        } else {
          newSelected.add(nodeId);
        }
      } else {
        // Single select - replace selection
        newSelected.clear();
        newSelected.add(nodeId);
      }

      return { selectedNodeIds: newSelected };
    });
  },
  setSelection: (selectedIds) => {
    set({ selectedNodeIds: new Set(selectedIds) });
  },

  selectNodesByType: (type) => {
    // This will be called with the nodes array from the component
    // For now, just store the type - component will handle the actual selection
    set({ selectedNodeIds: new Set() }); // Clear first, component will populate
  },

  clearSelection: () => {
    set({ selectedNodeIds: new Set() });
  },

  isNodeSelected: (nodeId) => {
    return get().selectedNodeIds.has(nodeId);
  },

  // Interaction actions
  setHoveredNode: (node) => {
    set({ hoveredNode: node });
  },

  startDragging: (nodes) => {
    set({ draggedNodes: nodes });
  },

  stopDragging: () => {
    set({ draggedNodes: [] });
  },

  startPanning: (startPos) => {
    set({ isPanning: true, panStart: startPos });
  },

  stopPanning: () => {
    set({ isPanning: false });
  },

  // Transform actions
  setZoomTransform: (transform) => {
    set((state) => ({
      zoomTransform:
        typeof transform === "function"
          ? transform(state.zoomTransform)
          : transform,
    }));
  },

  zoomIn: () => {
    set((state) => ({
      zoomTransform: {
        ...state.zoomTransform,
        k: Math.min(state.zoomTransform.k * 1.3, 4),
      },
    }));
  },

  zoomOut: () => {
    set((state) => ({
      zoomTransform: {
        ...state.zoomTransform,
        k: Math.max(state.zoomTransform.k * 0.7, 0.1),
      },
    }));
  },

  zoomReset: () => {
    set({ zoomTransform: { x: 0, y: 0, k: 1 } });
  },

  zoomTowardsCursor: (mousePos, delta, containerRect) => {
    set((state) => {
      const mouseX = mousePos.x - containerRect.left;
      const mouseY = mousePos.y - containerRect.top;
      const factor = delta > 0 ? 0.9 : 1.1;
      const newK = Math.max(0.1, Math.min(4, state.zoomTransform.k * factor));

      const newX =
        mouseX -
        ((mouseX - state.zoomTransform.x) / state.zoomTransform.k) * newK;
      const newY =
        mouseY -
        ((mouseY - state.zoomTransform.y) / state.zoomTransform.k) * newK;

      return {
        zoomTransform: { x: newX, y: newY, k: newK },
      };
    });
  },

  updatePan: (clientPos) => {
    set((state) => ({
      zoomTransform: {
        ...state.zoomTransform,
        x: clientPos.x - state.panStart.x,
        y: clientPos.y - state.panStart.y,
      },
    }));
  },

  // Multi-select mode
  setMultiSelectMode: (enabled) => {
    set({ isMultiSelectMode: enabled });
  },
}));
