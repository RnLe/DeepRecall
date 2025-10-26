/**
 * Whiteboard UI Components
 */

export * from "./WhiteboardView";
export * from "./WhiteboardToolbar";

// Re-export types from whiteboard package for convenience
export type {
  ToolId,
  InkingToolId,
  EraserToolId,
  SelectionToolId,
  NavigationToolId,
} from "@deeprecall/whiteboard/ink";
