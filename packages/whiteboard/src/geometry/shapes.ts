/**
 * Geometry - Shape Descriptors and Generation
 * Core shape primitives for inking aids
 */

import type { Point } from "../core/math";
import type { StrokePoint } from "@deeprecall/core";

/**
 * Shape type enumeration
 */
export type ShapeType = "line" | "circle" | "ellipse" | "rectangle" | "square";

/**
 * Line descriptor
 */
export interface LineDescriptor {
  type: "line";
  start: Point;
  end: Point;
}

/**
 * Circle descriptor
 */
export interface CircleDescriptor {
  type: "circle";
  center: Point;
  radius: number;
}

/**
 * Ellipse descriptor
 */
export interface EllipseDescriptor {
  type: "ellipse";
  center: Point;
  radiusX: number;
  radiusY: number;
  rotation: number; // Radians
}

/**
 * Rectangle descriptor (axis-aligned)
 */
export interface RectangleDescriptor {
  type: "rectangle";
  topLeft: Point;
  width: number;
  height: number;
}

/**
 * Square descriptor
 */
export interface SquareDescriptor {
  type: "square";
  topLeft: Point;
  size: number;
}

/**
 * Union type for all shape descriptors
 */
export type ShapeDescriptor =
  | LineDescriptor
  | CircleDescriptor
  | EllipseDescriptor
  | RectangleDescriptor
  | SquareDescriptor;

/**
 * Generate stroke points for a line
 */
export function generateLinePoints(desc: LineDescriptor): StrokePoint[] {
  return [
    {
      x: desc.start.x,
      y: desc.start.y,
      pressure: 0.5,
      timestamp: 0,
    },
    {
      x: desc.end.x,
      y: desc.end.y,
      pressure: 0.5,
      timestamp: 1,
    },
  ];
}

/**
 * Generate stroke points for a circle
 */
export function generateCirclePoints(
  desc: CircleDescriptor,
  segments: number = 64
): StrokePoint[] {
  const points: StrokePoint[] = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = desc.center.x + Math.cos(angle) * desc.radius;
    const y = desc.center.y + Math.sin(angle) * desc.radius;

    points.push({
      x,
      y,
      pressure: 0.5,
      timestamp: i,
    });
  }

  return points;
}

/**
 * Generate stroke points for an ellipse
 */
export function generateEllipsePoints(
  desc: EllipseDescriptor,
  segments: number = 64
): StrokePoint[] {
  const points: StrokePoint[] = [];
  const cos = Math.cos(desc.rotation);
  const sin = Math.sin(desc.rotation);

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const localX = Math.cos(angle) * desc.radiusX;
    const localY = Math.sin(angle) * desc.radiusY;

    // Rotate and translate
    const x = desc.center.x + localX * cos - localY * sin;
    const y = desc.center.y + localX * sin + localY * cos;

    points.push({
      x,
      y,
      pressure: 0.5,
      timestamp: i,
    });
  }

  return points;
}

/**
 * Generate stroke points for a rectangle
 */
export function generateRectanglePoints(
  desc: RectangleDescriptor
): StrokePoint[] {
  const { topLeft, width, height } = desc;

  return [
    { x: topLeft.x, y: topLeft.y, pressure: 0.5, timestamp: 0 },
    { x: topLeft.x + width, y: topLeft.y, pressure: 0.5, timestamp: 1 },
    {
      x: topLeft.x + width,
      y: topLeft.y + height,
      pressure: 0.5,
      timestamp: 2,
    },
    { x: topLeft.x, y: topLeft.y + height, pressure: 0.5, timestamp: 3 },
    { x: topLeft.x, y: topLeft.y, pressure: 0.5, timestamp: 4 }, // Close the loop
  ];
}

/**
 * Generate stroke points for a square
 */
export function generateSquarePoints(desc: SquareDescriptor): StrokePoint[] {
  const { topLeft, size } = desc;

  return [
    { x: topLeft.x, y: topLeft.y, pressure: 0.5, timestamp: 0 },
    { x: topLeft.x + size, y: topLeft.y, pressure: 0.5, timestamp: 1 },
    { x: topLeft.x + size, y: topLeft.y + size, pressure: 0.5, timestamp: 2 },
    { x: topLeft.x, y: topLeft.y + size, pressure: 0.5, timestamp: 3 },
    { x: topLeft.x, y: topLeft.y, pressure: 0.5, timestamp: 4 }, // Close the loop
  ];
}

/**
 * Generate stroke points for any shape descriptor
 */
export function generateShapePoints(desc: ShapeDescriptor): StrokePoint[] {
  switch (desc.type) {
    case "line":
      return generateLinePoints(desc);
    case "circle":
      return generateCirclePoints(desc);
    case "ellipse":
      return generateEllipsePoints(desc);
    case "rectangle":
      return generateRectanglePoints(desc);
    case "square":
      return generateSquarePoints(desc);
  }
}

/**
 * Adjust line endpoint
 */
export function adjustLineEnd(
  desc: LineDescriptor,
  newEnd: Point
): LineDescriptor {
  return {
    ...desc,
    end: newEnd,
  };
}

/**
 * Adjust circle radius based on cursor position
 */
export function adjustCircleRadius(
  desc: CircleDescriptor,
  cursorPos: Point
): CircleDescriptor {
  const dx = cursorPos.x - desc.center.x;
  const dy = cursorPos.y - desc.center.y;
  const newRadius = Math.sqrt(dx * dx + dy * dy);

  return {
    ...desc,
    radius: newRadius,
  };
}

/**
 * Adjust ellipse radii based on cursor position
 */
export function adjustEllipseRadius(
  desc: EllipseDescriptor,
  cursorPos: Point
): EllipseDescriptor {
  // Inverse rotate cursor to local space
  const cos = Math.cos(-desc.rotation);
  const sin = Math.sin(-desc.rotation);
  const dx = cursorPos.x - desc.center.x;
  const dy = cursorPos.y - desc.center.y;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  return {
    ...desc,
    radiusX: Math.abs(localX),
    radiusY: Math.abs(localY),
  };
}

/**
 * Adjust rectangle corner
 * Corner indices: 0=topLeft, 1=topRight, 2=bottomRight, 3=bottomLeft
 */
export function adjustRectangleCorner(
  desc: RectangleDescriptor,
  corner: number,
  newPos: Point
): RectangleDescriptor {
  const { topLeft, width, height } = desc;

  switch (corner) {
    case 0: // Top-left
      return {
        ...desc,
        topLeft: newPos,
        width: topLeft.x + width - newPos.x,
        height: topLeft.y + height - newPos.y,
      };

    case 1: // Top-right
      return {
        ...desc,
        topLeft: { x: topLeft.x, y: newPos.y },
        width: newPos.x - topLeft.x,
        height: topLeft.y + height - newPos.y,
      };

    case 2: // Bottom-right
      return {
        ...desc,
        width: newPos.x - topLeft.x,
        height: newPos.y - topLeft.y,
      };

    case 3: // Bottom-left
      return {
        ...desc,
        topLeft: { x: newPos.x, y: topLeft.y },
        width: topLeft.x + width - newPos.x,
        height: newPos.y - topLeft.y,
      };

    default:
      return desc;
  }
}

/**
 * Adjust square corner (maintains aspect ratio)
 */
export function adjustSquareCorner(
  desc: SquareDescriptor,
  corner: number,
  newPos: Point
): SquareDescriptor {
  const { topLeft, size } = desc;

  switch (corner) {
    case 0: { // Top-left
      const dx = topLeft.x + size - newPos.x;
      const dy = topLeft.y + size - newPos.y;
      const newSize = Math.max(Math.abs(dx), Math.abs(dy));
      return {
        ...desc,
        topLeft: {
          x: topLeft.x + size - newSize,
          y: topLeft.y + size - newSize,
        },
        size: newSize,
      };
    }

    case 1: { // Top-right
      const dx = newPos.x - topLeft.x;
      const dy = topLeft.y + size - newPos.y;
      const newSize = Math.max(Math.abs(dx), Math.abs(dy));
      return {
        ...desc,
        topLeft: { x: topLeft.x, y: topLeft.y + size - newSize },
        size: newSize,
      };
    }

    case 2: { // Bottom-right
      const dx = newPos.x - topLeft.x;
      const dy = newPos.y - topLeft.y;
      const newSize = Math.max(Math.abs(dx), Math.abs(dy));
      return {
        ...desc,
        size: newSize,
      };
    }

    case 3: { // Bottom-left
      const dx = topLeft.x + size - newPos.x;
      const dy = newPos.y - topLeft.y;
      const newSize = Math.max(Math.abs(dx), Math.abs(dy));
      return {
        ...desc,
        topLeft: { x: topLeft.x + size - newSize, y: topLeft.y },
        size: newSize,
      };
    }

    default:
      return desc;
  }
}

/**
 * Adjust shape based on cursor position (polymorphic)
 */
export function adjustShape(
  desc: ShapeDescriptor,
  cursorPos: Point,
  metadata?: { corner?: number }
): ShapeDescriptor {
  switch (desc.type) {
    case "line":
      return adjustLineEnd(desc, cursorPos);

    case "circle":
      return adjustCircleRadius(desc, cursorPos);

    case "ellipse":
      return adjustEllipseRadius(desc, cursorPos);

    case "rectangle":
      return adjustRectangleCorner(desc, metadata?.corner ?? 2, cursorPos);

    case "square":
      return adjustSquareCorner(desc, metadata?.corner ?? 2, cursorPos);
  }
}
