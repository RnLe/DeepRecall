/**
 * Smoothing - Stroke Interpolation
 * Catmull-Rom spline for smooth curves
 */

import type { Point } from "../core/math";

/**
 * Generate smooth curve points using Catmull-Rom interpolation
 */
export function smoothCurve(
  points: Point[],
  segmentsPerSpan: number = 16
): Point[] {
  if (points.length < 2) return points;
  if (points.length === 2) return points;

  const smoothPoints: Point[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    for (let t = 0; t < segmentsPerSpan; t++) {
      const u = t / segmentsPerSpan;
      const point = catmullRomPoint(p0, p1, p2, p3, u);
      smoothPoints.push(point);
    }
  }

  // Add final point
  smoothPoints.push(points[points.length - 1]);

  return smoothPoints;
}

/**
 * Catmull-Rom interpolation for a single point
 */
function catmullRomPoint(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number
): Point {
  const t2 = t * t;
  const t3 = t2 * t;

  const x =
    0.5 *
    (2 * p1.x +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

  const y =
    0.5 *
    (2 * p1.y +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

  return { x, y };
}

/**
 * Simplify polyline using Ramer-Douglas-Peucker algorithm
 */
export function simplifyPolyline(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;

  const result: Point[] = [];
  rdpRecursive(points, 0, points.length - 1, tolerance, result);
  return result;
}

function rdpRecursive(
  points: Point[],
  start: number,
  end: number,
  tolerance: number,
  result: Point[]
): void {
  if (end - start < 1) {
    result.push(points[start]);
    return;
  }

  // Find point with maximum distance from line segment
  let maxDist = 0;
  let maxIndex = start;

  for (let i = start + 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[start], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance exceeds tolerance, split recursively
  if (maxDist > tolerance) {
    rdpRecursive(points, start, maxIndex, tolerance, result);
    rdpRecursive(points, maxIndex, end, tolerance, result);
  } else {
    result.push(points[start]);
    if (end === points.length - 1) {
      result.push(points[end]);
    }
  }
}

function perpendicularDistance(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    const px = point.x - lineStart.x;
    const py = point.y - lineStart.y;
    return Math.sqrt(px * px + py * py);
  }

  const t =
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq;
  const clampedT = Math.max(0, Math.min(1, t));

  const projX = lineStart.x + clampedT * dx;
  const projY = lineStart.y + clampedT * dy;

  const distX = point.x - projX;
  const distY = point.y - projY;

  return Math.sqrt(distX * distX + distY * distY);
}

/**
 * Exponential moving average smoothing
 * Fast, single-pass smoothing suitable for real-time input
 */
export function exponentialSmoothing(
  points: Point[],
  alpha: number = 0.3
): Point[] {
  if (points.length < 2) return points;

  const smoothed: Point[] = [points[0]]; // Keep first point as-is

  for (let i = 1; i < points.length; i++) {
    const prev = smoothed[i - 1];
    const curr = points[i];

    // Exponential moving average: smoothed = alpha * current + (1-alpha) * previous
    smoothed.push({
      x: alpha * curr.x + (1 - alpha) * prev.x,
      y: alpha * curr.y + (1 - alpha) * prev.y,
    });
  }

  return smoothed;
}
