/**
 * Tools - Unified Tool System
 * Merges tools and brushes into a single abstraction
 */

import type { InkingBehaviorConfig } from "./inking";

/**
 * Tool categories
 */
export type ToolType = "inking" | "eraser" | "selection" | "navigation";

/**
 * Inking tool identifiers
 */
export type InkingToolId = "pen" | "highlighter" | "marker" | "pencil";

/**
 * Eraser tool identifiers
 */
export type EraserToolId = "vector-eraser" | "bitmap-eraser";

/**
 * Selection tool identifiers
 */
export type SelectionToolId = "lasso" | "box-select";

/**
 * Navigation tool identifiers
 */
export type NavigationToolId = "pan" | "zoom";

/**
 * All tool identifiers
 */
export type ToolId =
  | InkingToolId
  | EraserToolId
  | SelectionToolId
  | NavigationToolId;

/**
 * Visual style configuration for tools
 */
export interface ToolVisualConfig {
  color: string;
  baseWidth: number; // Base width in world units
  opacity: number;
}

/**
 * Base tool interface
 */
export interface Tool<TId extends ToolId = ToolId> {
  id: TId;
  type: ToolType;
  name: string;
  icon?: string; // Icon identifier for UI
  description?: string;
}

/**
 * Inking tool - creates strokes
 */
export interface InkingTool extends Tool<InkingToolId> {
  type: "inking";
  visual: ToolVisualConfig;
  inking: InkingBehaviorConfig;
}

/**
 * Eraser tool - removes strokes or parts of strokes
 */
export interface EraserTool extends Tool<EraserToolId> {
  type: "eraser";
  width: number; // Eraser width
  mode: "vector" | "bitmap"; // Vector = remove whole strokes, bitmap = split strokes
}

/**
 * Selection tool - selects and manipulates strokes
 */
export interface SelectionTool extends Tool<SelectionToolId> {
  type: "selection";
  mode: "lasso" | "box"; // Freeform lasso or rectangular selection
}

/**
 * Navigation tool - camera control
 */
export interface NavigationTool extends Tool<NavigationToolId> {
  type: "navigation";
  mode: "pan" | "zoom";
}

/**
 * Any tool type
 */
export type AnyTool = InkingTool | EraserTool | SelectionTool | NavigationTool;

/**
 * Default tool presets
 */
export const TOOL_PRESETS: Record<ToolId, AnyTool> = {
  // Inking tools
  pen: {
    id: "pen",
    type: "inking",
    name: "Pen",
    icon: "pen",
    description: "Smooth ballpoint pen with pressure sensitivity",
    visual: {
      color: "#000000",
      baseWidth: 2,
      opacity: 1,
    },
    inking: {
      pointDistribution: {
        algorithm: "hybrid",
        minDistance: 3, // Larger distance = fewer points
        minInterval: 16,
        speedAdaptive: true,
      },
      smoothing: {
        algorithm: "exponential", // Faster, no point multiplication
        alpha: 0.25, // Light smoothing
        simplifyTolerance: 0.5,
      },
      pressureResponse: {
        curve: "ease-out",
        sensitivity: 0.5,
        minWidth: 0.5,
        maxWidth: 2.0,
      },
      speedResponse: {
        enabled: true,
        minSpeed: 0.1,
        maxSpeed: 2.0,
        widthMultiplier: 0.2,
      },
    },
  },

  highlighter: {
    id: "highlighter",
    type: "inking",
    name: "Highlighter",
    icon: "highlighter",
    description: "Wide semi-transparent marker for highlighting",
    visual: {
      color: "#ffff00",
      baseWidth: 12,
      opacity: 0.4,
    },
    inking: {
      pointDistribution: {
        algorithm: "distance",
        minDistance: 4,
        minInterval: 20,
        speedAdaptive: false,
      },
      smoothing: {
        algorithm: "catmull-rom",
        segmentsPerSpan: 8,
        simplifyTolerance: 1.0,
      },
      pressureResponse: {
        curve: "constant",
        sensitivity: 0.1,
        minWidth: 0.9,
        maxWidth: 1.1,
      },
      speedResponse: {
        enabled: false,
        minSpeed: 0,
        maxSpeed: 1,
        widthMultiplier: 0,
      },
    },
  },

  marker: {
    id: "marker",
    type: "inking",
    name: "Marker",
    icon: "marker",
    description: "Medium-width marker with moderate pressure response",
    visual: {
      color: "#0000ff",
      baseWidth: 4,
      opacity: 0.8,
    },
    inking: {
      pointDistribution: {
        algorithm: "hybrid",
        minDistance: 3,
        minInterval: 15,
        speedAdaptive: true,
      },
      smoothing: {
        algorithm: "catmull-rom",
        segmentsPerSpan: 12,
        simplifyTolerance: 0.8,
      },
      pressureResponse: {
        curve: "linear",
        sensitivity: 0.3,
        minWidth: 0.7,
        maxWidth: 1.3,
      },
      speedResponse: {
        enabled: true,
        minSpeed: 0.2,
        maxSpeed: 1.5,
        widthMultiplier: 0.15,
      },
    },
  },

  pencil: {
    id: "pencil",
    type: "inking",
    name: "Pencil",
    icon: "pencil",
    description: "Textured pencil with strong pressure response",
    visual: {
      color: "#333333",
      baseWidth: 1.5,
      opacity: 0.7,
    },
    inking: {
      pointDistribution: {
        algorithm: "hybrid",
        minDistance: 1.4,
        minInterval: 10,
        speedAdaptive: true,
      },
      smoothing: {
        algorithm: "exponential",
        alpha: 0.3,
        simplifyTolerance: 0.3,
      },
      pressureResponse: {
        curve: "ease-in",
        sensitivity: 0.7,
        minWidth: 0.3,
        maxWidth: 2.5,
      },
      speedResponse: {
        enabled: true,
        minSpeed: 0.05,
        maxSpeed: 2.5,
        widthMultiplier: 0.3,
      },
    },
  },

  // Eraser tools
  "vector-eraser": {
    id: "vector-eraser",
    type: "eraser",
    name: "Eraser",
    icon: "eraser",
    description: "Remove entire strokes that intersect",
    width: 20,
    mode: "vector",
  },

  "bitmap-eraser": {
    id: "bitmap-eraser",
    type: "eraser",
    name: "Precise Eraser",
    icon: "eraser-precise",
    description: "Split and remove parts of strokes",
    width: 10,
    mode: "bitmap",
  },

  // Selection tools
  lasso: {
    id: "lasso",
    type: "selection",
    name: "Lasso",
    icon: "lasso",
    description: "Freeform selection",
    mode: "lasso",
  },

  "box-select": {
    id: "box-select",
    type: "selection",
    name: "Box Select",
    icon: "box",
    description: "Rectangular selection",
    mode: "box",
  },

  // Navigation tools
  pan: {
    id: "pan",
    type: "navigation",
    name: "Pan",
    icon: "hand",
    description: "Move the canvas",
    mode: "pan",
  },

  zoom: {
    id: "zoom",
    type: "navigation",
    name: "Zoom",
    icon: "zoom",
    description: "Zoom in and out",
    mode: "zoom",
  },
};

/**
 * Get tool by ID
 */
export function getTool<T extends ToolId>(id: T): AnyTool {
  const tool = TOOL_PRESETS[id];
  if (!tool) {
    throw new Error(`Tool not found: ${id}`);
  }
  return tool;
}

/**
 * Get inking tool by ID (with type guard)
 */
export function getInkingTool(id: InkingToolId): InkingTool {
  const tool = getTool(id);
  if (tool.type !== "inking") {
    throw new Error(`Tool ${id} is not an inking tool`);
  }
  return tool as InkingTool;
}

/**
 * Get eraser tool by ID (with type guard)
 */
export function getEraserTool(id: EraserToolId): EraserTool {
  const tool = getTool(id);
  if (tool.type !== "eraser") {
    throw new Error(`Tool ${id} is not an eraser tool`);
  }
  return tool as EraserTool;
}

/**
 * Get selection tool by ID (with type guard)
 */
export function getSelectionTool(id: SelectionToolId): SelectionTool {
  const tool = getTool(id);
  if (tool.type !== "selection") {
    throw new Error(`Tool ${id} is not a selection tool`);
  }
  return tool as SelectionTool;
}

/**
 * Get all tools of a specific type
 */
export function getToolsByType<T extends ToolType>(type: T): AnyTool[] {
  return Object.values(TOOL_PRESETS).filter((tool) => tool.type === type);
}

/**
 * Type guard for inking tools
 */
export function isInkingTool(tool: AnyTool): tool is InkingTool {
  return tool.type === "inking";
}

/**
 * Type guard for eraser tools
 */
export function isEraserTool(tool: AnyTool): tool is EraserTool {
  return tool.type === "eraser";
}

/**
 * Type guard for selection tools
 */
export function isSelectionTool(tool: AnyTool): tool is SelectionTool {
  return tool.type === "selection";
}

/**
 * Type guard for navigation tools
 */
export function isNavigationTool(tool: AnyTool): tool is NavigationTool {
  return tool.type === "navigation";
}
