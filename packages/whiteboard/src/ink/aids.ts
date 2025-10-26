/**
 * Inking Aids - Shape Detection and Manipulation
 * Converts freehand strokes to geometric primitives via hold-and-drag
 */

import type { StrokePoint } from "@deeprecall/core";
import type { ToolId } from "./tools";
import type { ShapeDescriptor, ShapeType } from "../geometry/shapes";
import { recognizeShape, isClosedShape } from "../geometry/recognition";
import { generateShapePoints, adjustShape } from "../geometry/shapes";

/**
 * Aid state for tracking detection and adjustment
 */
export interface AidState {
  enabled: boolean;
  holdTimer: NodeJS.Timeout | null;
  detectedShape: ShapeDescriptor | null;
  isAdjusting: boolean; // User is dragging after detection
  originalPoints: StrokePoint[]; // Backup for cancellation
  adjustmentMetadata: { corner?: number }; // Corner/edge being adjusted
  lastSample: { x: number; y: number; timestamp: number } | null;
  holdSnapshot: StrokePoint[] | null;
  recentSamples: Array<{ x: number; y: number; timestamp: number }>; // For velocity calculation
}

/**
 * Aid configuration
 */
export interface AidConfig {
  enabledShapes: ShapeType[];
  holdDuration: number; // ms, default 500
  holdVelocityThreshold: number; // px/ms, max velocity to trigger hold
  detectionThreshold: number; // Confidence threshold, 0-1
}

/**
 * Default aid configuration
 */
export const DEFAULT_AID_CONFIG: AidConfig = {
  enabledShapes: ["line", "circle", "ellipse", "rectangle", "square"],
  holdDuration: 1500, // 1.5 seconds for intentional hold
  holdVelocityThreshold: 0.002, // Very strict: ~0.12 pixels per 60ms frame
  detectionThreshold: 0.7,
};

/**
 * Aid detector class
 */
export class AidDetector {
  public readonly config: AidConfig;

  constructor(config: Partial<AidConfig> = {}) {
    this.config = { ...DEFAULT_AID_CONFIG, ...config };
  }

  /**
   * Check if tool supports a specific shape type
   */
  isShapeAllowed(toolId: ToolId, shapeType: ShapeType): boolean {
    // Line is always allowed
    if (shapeType === "line") return true;

    // Marker and highlighter only support line
    if (toolId === "marker" || toolId === "highlighter") {
      return false;
    }

    // Pen and pencil support all shapes
    return this.config.enabledShapes.includes(shapeType);
  }

  /**
   * Get allowed shapes for a tool
   */
  getAllowedShapes(toolId: ToolId): ShapeType[] {
    if (toolId === "marker" || toolId === "highlighter") {
      return ["line"];
    }
    return this.config.enabledShapes;
  }

  /**
   * Try to detect shape from points
   * Returns null if no shape detected with sufficient confidence
   */
  detectShape(points: StrokePoint[], toolId: ToolId): ShapeDescriptor | null {
    if (points.length < 5) return null;

    // Attempt recognition
    const shape = recognizeShape(points);
    if (!shape) return null;

    // Check if shape is allowed for this tool
    if (!this.isShapeAllowed(toolId, shape.type)) {
      return null;
    }

    return shape;
  }

  /**
   * Determine which corner/edge is closest to cursor for adjustment
   */
  determineAdjustmentPoint(
    shape: ShapeDescriptor,
    cursorPos: { x: number; y: number }
  ): { corner?: number } {
    switch (shape.type) {
      case "line":
        // No corner needed for line
        return {};

      case "circle":
      case "ellipse":
        // Radial adjustment, no specific corner
        return {};

      case "rectangle":
      case "square": {
        // Find closest corner
        const corners =
          shape.type === "rectangle"
            ? [
                { x: shape.topLeft.x, y: shape.topLeft.y }, // 0: top-left
                { x: shape.topLeft.x + shape.width, y: shape.topLeft.y }, // 1: top-right
                {
                  x: shape.topLeft.x + shape.width,
                  y: shape.topLeft.y + shape.height,
                }, // 2: bottom-right
                { x: shape.topLeft.x, y: shape.topLeft.y + shape.height }, // 3: bottom-left
              ]
            : [
                { x: shape.topLeft.x, y: shape.topLeft.y },
                { x: shape.topLeft.x + shape.size, y: shape.topLeft.y },
                {
                  x: shape.topLeft.x + shape.size,
                  y: shape.topLeft.y + shape.size,
                },
                { x: shape.topLeft.x, y: shape.topLeft.y + shape.size },
              ];

        let closestCorner = 0;
        let minDist = Infinity;

        for (let i = 0; i < corners.length; i++) {
          const dx = cursorPos.x - corners[i].x;
          const dy = cursorPos.y - corners[i].y;
          const dist = dx * dx + dy * dy;
          if (dist < minDist) {
            minDist = dist;
            closestCorner = i;
          }
        }

        return { corner: closestCorner };
      }
    }
  }

  /**
   * Adjust shape based on cursor position
   */
  adjustShape(
    shape: ShapeDescriptor,
    cursorPos: { x: number; y: number },
    metadata: { corner?: number }
  ): ShapeDescriptor {
    return adjustShape(shape, cursorPos, metadata);
  }

  /**
   * Generate stroke points from shape descriptor
   */
  generatePoints(shape: ShapeDescriptor): StrokePoint[] {
    return generateShapePoints(shape);
  }

  /**
   * Check if shape should have fill
   */
  shouldHaveFill(shape: ShapeDescriptor): boolean {
    return isClosedShape(shape.type);
  }

  /**
   * Get default fill opacity for shape type
   */
  getDefaultFillOpacity(shapeType: ShapeType): number {
    return shapeType === "line" ? 0 : 0.15;
  }
}

/**
 * Calculate velocity between two samples
 */
export function calculateVelocity(
  current: { x: number; y: number; timestamp: number },
  previous: { x: number; y: number; timestamp: number } | null
): number {
  if (!previous) return 0;

  const dx = current.x - previous.x;
  const dy = current.y - previous.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const timeDelta = current.timestamp - previous.timestamp;

  if (timeDelta <= 0) return 0;

  return distance / timeDelta; // pixels per ms
}

/**
 * Calculate average velocity from recent samples (for stillness detection)
 * Checks if cursor has moved in the MOST RECENT time period (not averaged over entire window)
 */
export function calculateRecentVelocity(
  recentSamples: Array<{ x: number; y: number; timestamp: number }>,
  windowMs: number = 100
): number {
  if (recentSamples.length < 2) return 0;

  const now = recentSamples[recentSamples.length - 1].timestamp;
  const cutoff = now - windowMs;

  // Get samples within the recent window (last 100ms by default)
  const windowSamples = recentSamples.filter((s) => s.timestamp >= cutoff);
  if (windowSamples.length < 2) {
    // Not enough recent samples - check if we have ANY recent sample
    // If last sample is old (>100ms), cursor is definitely still
    const lastSample = recentSamples[recentSamples.length - 1];
    const age = performance.now() - lastSample.timestamp;
    if (age > windowMs) {
      return 0; // Cursor hasn't moved in over windowMs
    }
    return 0;
  }

  // Calculate total distance moved in the recent window
  let totalDistance = 0;
  for (let i = 1; i < windowSamples.length; i++) {
    const dx = windowSamples[i].x - windowSamples[i - 1].x;
    const dy = windowSamples[i].y - windowSamples[i - 1].y;
    totalDistance += Math.sqrt(dx * dx + dy * dy);
  }

  const timeDelta =
    windowSamples[windowSamples.length - 1].timestamp -
    windowSamples[0].timestamp;
  if (timeDelta <= 0) {
    // All samples at same timestamp - no movement
    return totalDistance > 0.1 ? 999 : 0; // Prevent division by zero
  }

  return totalDistance / timeDelta; // pixels per ms
}

/**
 * Create default aid state
 */
export function createDefaultAidState(): AidState {
  return {
    enabled: true,
    holdTimer: null,
    detectedShape: null,
    isAdjusting: false,
    originalPoints: [],
    adjustmentMetadata: {},
    lastSample: null,
    holdSnapshot: null,
    recentSamples: [],
  };
}
