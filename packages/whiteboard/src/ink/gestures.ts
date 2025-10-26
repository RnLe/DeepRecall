/**
 * Gestures - Tool State Machine
 * Handles drawing, erasing, and selection gestures
 */

import type { PointerSample } from "./input";
import type { Point } from "../core/math";

export type Tool = "pen" | "eraser" | "lasso" | "pan";

export type GestureState =
  | { type: "idle" }
  | { type: "drawing"; startTime: number; samples: PointerSample[] }
  | { type: "erasing"; samples: PointerSample[] }
  | { type: "selecting"; startPoint: Point; currentPoint: Point }
  | { type: "panning"; startPoint: Point; lastPoint: Point };

/**
 * Gesture FSM for handling pointer interactions
 */
export class GestureFSM {
  private state: GestureState = { type: "idle" };
  private currentTool: Tool;

  constructor(initialTool: Tool = "pen") {
    this.currentTool = initialTool;
  }

  /**
   * Get current state
   */
  getState(): GestureState {
    return this.state;
  }

  /**
   * Set active tool
   */
  setTool(tool: Tool): void {
    this.currentTool = tool;
    // Cancel any active gesture when tool changes
    this.state = { type: "idle" };
  }

  /**
   * Get current tool
   */
  getTool(): Tool {
    return this.currentTool;
  }

  /**
   * Handle pointer down
   */
  onPointerDown(sample: PointerSample, isPanButton: boolean): void {
    // Right-click or middle button = pan (overrides tool)
    if (isPanButton) {
      this.state = {
        type: "panning",
        startPoint: { x: sample.x, y: sample.y },
        lastPoint: { x: sample.x, y: sample.y },
      };
      return;
    }

    // Tool-specific gesture start
    switch (this.currentTool) {
      case "pen":
        this.state = {
          type: "drawing",
          startTime: sample.timestamp,
          samples: [sample],
        };
        break;

      case "eraser":
        this.state = {
          type: "erasing",
          samples: [sample],
        };
        break;

      case "lasso":
        this.state = {
          type: "selecting",
          startPoint: { x: sample.x, y: sample.y },
          currentPoint: { x: sample.x, y: sample.y },
        };
        break;

      case "pan":
        this.state = {
          type: "panning",
          startPoint: { x: sample.x, y: sample.y },
          lastPoint: { x: sample.x, y: sample.y },
        };
        break;
    }
  }

  /**
   * Handle pointer move
   */
  onPointerMove(sample: PointerSample): void {
    switch (this.state.type) {
      case "drawing":
        this.state.samples.push(sample);
        break;

      case "erasing":
        this.state.samples.push(sample);
        break;

      case "selecting":
        this.state.currentPoint = { x: sample.x, y: sample.y };
        break;

      case "panning":
        this.state.lastPoint = { x: sample.x, y: sample.y };
        break;
    }
  }

  /**
   * Handle pointer up - returns completed gesture
   */
  onPointerUp(sample: PointerSample): GestureState {
    const completedGesture = this.state;
    this.state = { type: "idle" };
    return completedGesture;
  }

  /**
   * Cancel current gesture
   */
  cancel(): void {
    this.state = { type: "idle" };
  }

  /**
   * Check if gesture is active
   */
  isActive(): boolean {
    return this.state.type !== "idle";
  }
}
