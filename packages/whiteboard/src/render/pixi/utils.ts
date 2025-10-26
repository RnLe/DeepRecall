/**
 * PixiJS Utilities
 * Helper functions for PixiJS rendering
 */

import type { Rect } from "../../core/math";
import type { StrokePoint } from "@deeprecall/core";

/**
 * Convert hex color string to PixiJS color number
 * @example "#ff0000" -> 0xff0000
 */
export function hexToPixiColor(hex: string): number {
  const cleaned = hex.replace("#", "");
  return parseInt(cleaned, 16);
}

/**
 * Convert PixiJS color number to hex string
 * @example 0xff0000 -> "#ff0000"
 */
export function pixiColorToHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/**
 * Convert stroke points to PixiJS-compatible path
 */
export function strokePointsToPath(
  points: StrokePoint[]
): { x: number; y: number }[] {
  return points.map((p) => ({ x: p.x, y: p.y }));
}

/**
 * Calculate bounds from stroke points
 */
export function calculateStrokeBounds(points: StrokePoint[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Check if rectangle intersects viewport
 */
export function intersectsViewport(
  bounds: { x: number; y: number; width: number; height: number },
  viewport: Rect
): boolean {
  return !(
    bounds.x + bounds.width < viewport.x ||
    bounds.x > viewport.x + viewport.width ||
    bounds.y + bounds.height < viewport.y ||
    bounds.y > viewport.y + viewport.height
  );
}

/**
 * Smooth line between two points using quadratic curves
 */
export function smoothLine(
  points: { x: number; y: number }[]
): { type: "line" | "curve"; points: number[] }[] {
  if (points.length < 3) {
    return [{ type: "line", points: points.flatMap((p) => [p.x, p.y]) }];
  }

  const segments: { type: "line" | "curve"; points: number[] }[] = [];

  // Start with line to first point
  segments.push({ type: "line", points: [points[0].x, points[0].y] });

  // Use quadratic curves between points
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    const cpY = (p0.y + p1.y) / 2;

    segments.push({
      type: "curve",
      points: [p0.x, p0.y, cpX, cpY],
    });
  }

  // End with line to last point
  const last = points[points.length - 1];
  segments.push({ type: "line", points: [last.x, last.y] });

  return segments;
}
