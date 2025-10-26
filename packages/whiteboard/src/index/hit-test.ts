/**
 * Hit Testing - Precise Intersection Tests
 */

import type { Point, Rect } from "../core/math";
import { MathUtils } from "../core/math";
import type { StrokeObject, AnySceneObject } from "../scene/objects";

/**
 * Test if point hits a stroke (with tolerance)
 */
export function hitTestStroke(
  point: Point,
  stroke: StrokeObject,
  tolerance: number = 5
): boolean {
  // First check bounding box (fast reject)
  const expandedBBox: Rect = {
    x: stroke.boundingBox.x - tolerance,
    y: stroke.boundingBox.y - tolerance,
    width: stroke.boundingBox.width + tolerance * 2,
    height: stroke.boundingBox.height + tolerance * 2,
  };

  if (!MathUtils.pointInRect(point, expandedBBox)) {
    return false;
  }

  // Detailed hit test: check distance to each line segment
  const hitRadius = tolerance + stroke.style.width / 2;
  const points = stroke.points;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const dist = distanceToSegment(point, p1, p2);
    if (dist <= hitRadius) {
      return true;
    }
  }

  return false;
}

/**
 * Test if point hits any object (generic)
 */
export function hitTestObject(
  point: Point,
  obj: AnySceneObject,
  tolerance: number = 5
): boolean {
  switch (obj.kind) {
    case "stroke":
      return hitTestStroke(point, obj, tolerance);

    default:
      // For non-stroke objects, just check bounding box
      return MathUtils.pointInRect(point, obj.boundingBox);
  }
}

/**
 * Calculate distance from point to line segment
 */
function distanceToSegment(
  point: Point,
  segStart: Point,
  segEnd: Point
): number {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Degenerate segment (point)
    const px = point.x - segStart.x;
    const py = point.y - segStart.y;
    return Math.sqrt(px * px + py * py);
  }

  // Project point onto line
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSq
    )
  );

  const projX = segStart.x + t * dx;
  const projY = segStart.y + t * dy;

  const distX = point.x - projX;
  const distY = point.y - projY;

  return Math.sqrt(distX * distX + distY * distY);
}

/**
 * Test if lasso path contains object
 */
export function lassoContainsObject(
  lassoPath: Point[],
  obj: AnySceneObject
): boolean {
  // Simple implementation: check if bounding box center is inside lasso
  const center: Point = {
    x: obj.boundingBox.x + obj.boundingBox.width / 2,
    y: obj.boundingBox.y + obj.boundingBox.height / 2,
  };

  return pointInPolygon(center, lassoPath);
}

/**
 * Point-in-polygon test using ray casting
 */
function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}
