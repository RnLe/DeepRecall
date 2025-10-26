/**
 * Geometry - Shape Fitting Algorithms
 * Least-squares fitting for geometric primitives
 */

import type { Point } from "../core/math";
import type { StrokePoint } from "@deeprecall/core";
import type {
  LineDescriptor,
  CircleDescriptor,
  EllipseDescriptor,
  RectangleDescriptor,
  SquareDescriptor,
} from "./shapes";

/**
 * Fit a line to points using least squares
 */
export function fitLine(points: StrokePoint[]): LineDescriptor {
  if (points.length === 0) {
    return { type: "line", start: { x: 0, y: 0 }, end: { x: 0, y: 0 } };
  }

  if (points.length === 1) {
    return {
      type: "line",
      start: { x: points[0].x, y: points[0].y },
      end: { x: points[0].x, y: points[0].y },
    };
  }

  // Use first and last points as endpoints
  const start = { x: points[0].x, y: points[0].y };
  const end = {
    x: points[points.length - 1].x,
    y: points[points.length - 1].y,
  };

  return { type: "line", start, end };
}

/**
 * Calculate R² (coefficient of determination) for line fit
 * Returns value 0-1, where 1 = perfect fit
 */
export function calculateLineR2(points: StrokePoint[]): number {
  if (points.length < 3) return 1;

  const line = fitLine(points);
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const lineLength = Math.sqrt(dx * dx + dy * dy);

  if (lineLength === 0) return 0;

  // Calculate mean y
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

  // Calculate total sum of squares and residual sum of squares
  let ssTot = 0;
  let ssRes = 0;

  for (const point of points) {
    // Distance from point to line
    const px = point.x - line.start.x;
    const py = point.y - line.start.y;
    const dot = (px * dx + py * dy) / lineLength;
    const projX = line.start.x + (dx / lineLength) * dot;
    const projY = line.start.y + (dy / lineLength) * dot;
    const dist = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);

    ssRes += dist * dist;
    ssTot += (point.y - meanY) ** 2;
  }

  if (ssTot === 0) return 1;
  return 1 - ssRes / ssTot;
}

/**
 * Fit a circle to points using algebraic fit
 */
export function fitCircle(points: StrokePoint[]): CircleDescriptor {
  if (points.length < 3) {
    const center = { x: 0, y: 0 };
    if (points.length > 0) {
      center.x = points[0].x;
      center.y = points[0].y;
    }
    return { type: "circle", center, radius: 0 };
  }

  // Calculate centroid
  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const cx = sumX / points.length;
  const cy = sumY / points.length;

  // Calculate average radius
  let sumR = 0;
  for (const p of points) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    sumR += Math.sqrt(dx * dx + dy * dy);
  }
  const radius = sumR / points.length;

  return {
    type: "circle",
    center: { x: cx, y: cy },
    radius,
  };
}

/**
 * Calculate circle fit quality (0-1, where 1 = perfect circle)
 */
export function calculateCircleQuality(
  points: StrokePoint[],
  circle: CircleDescriptor
): number {
  if (points.length < 3) return 0;

  // Calculate variance in radius
  let sumSqError = 0;
  for (const p of points) {
    const dx = p.x - circle.center.x;
    const dy = p.y - circle.center.y;
    const actualR = Math.sqrt(dx * dx + dy * dy);
    const error = actualR - circle.radius;
    sumSqError += error * error;
  }

  const variance = sumSqError / points.length;
  const normalizedVariance = variance / (circle.radius * circle.radius);

  // Convert to quality score (0-1)
  return Math.max(0, 1 - normalizedVariance * 10);
}

/**
 * Fit an ellipse to points
 */
export function fitEllipse(points: StrokePoint[]): EllipseDescriptor {
  if (points.length < 5) {
    const circle = fitCircle(points);
    return {
      type: "ellipse",
      center: circle.center,
      radiusX: circle.radius,
      radiusY: circle.radius,
      rotation: 0,
    };
  }

  // Simple ellipse fit: Use PCA to find major/minor axes
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;

  // Covariance matrix
  let cxx = 0,
    cxy = 0,
    cyy = 0;
  for (const p of points) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    cxx += dx * dx;
    cxy += dx * dy;
    cyy += dy * dy;
  }
  cxx /= points.length;
  cxy /= points.length;
  cyy /= points.length;

  // Eigenvalues via quadratic formula
  const trace = cxx + cyy;
  const det = cxx * cyy - cxy * cxy;
  const lambda1 = trace / 2 + Math.sqrt((trace * trace) / 4 - det);
  const lambda2 = trace / 2 - Math.sqrt((trace * trace) / 4 - det);

  // Rotation angle from first eigenvector
  const rotation = Math.atan2(lambda1 - cxx, cxy);

  // Radii from eigenvalues
  const radiusX = Math.sqrt(Math.abs(lambda1)) * 2;
  const radiusY = Math.sqrt(Math.abs(lambda2)) * 2;

  return {
    type: "ellipse",
    center: { x: cx, y: cy },
    radiusX: Math.max(radiusX, radiusY),
    radiusY: Math.min(radiusX, radiusY),
    rotation,
  };
}

/**
 * Calculate ellipse aspect ratio
 */
export function calculateEllipseAspectRatio(
  ellipse: EllipseDescriptor
): number {
  return ellipse.radiusX / ellipse.radiusY;
}

/**
 * Fit a rectangle to points using bounding box
 */
export function fitRectangle(points: StrokePoint[]): RectangleDescriptor {
  if (points.length === 0) {
    return { type: "rectangle", topLeft: { x: 0, y: 0 }, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  return {
    type: "rectangle",
    topLeft: { x: minX, y: minY },
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Calculate rectangle quality (checks for 4 corners and right angles)
 */
export function calculateRectangleQuality(
  points: StrokePoint[],
  rect: RectangleDescriptor
): number {
  if (points.length < 4) return 0;

  // Check if points form approximately 4 corners
  // This is a simplified heuristic
  const corners = [
    { x: rect.topLeft.x, y: rect.topLeft.y },
    { x: rect.topLeft.x + rect.width, y: rect.topLeft.y },
    { x: rect.topLeft.x + rect.width, y: rect.topLeft.y + rect.height },
    { x: rect.topLeft.x, y: rect.topLeft.y + rect.height },
  ];

  // Find closest point to each corner
  let totalError = 0;
  for (const corner of corners) {
    let minDist = Infinity;
    for (const p of points) {
      const dx = p.x - corner.x;
      const dy = p.y - corner.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      minDist = Math.min(minDist, dist);
    }
    totalError += minDist;
  }

  const avgError = totalError / 4;
  const maxDim = Math.max(rect.width, rect.height);
  const normalizedError = avgError / maxDim;

  return Math.max(0, 1 - normalizedError * 5);
}

/**
 * Fit a square to points (rectangle with equal sides)
 */
export function fitSquare(points: StrokePoint[]): SquareDescriptor {
  const rect = fitRectangle(points);
  const size = (rect.width + rect.height) / 2;

  return {
    type: "square",
    topLeft: rect.topLeft,
    size,
  };
}

/**
 * Calculate rectangle aspect ratio
 */
export function calculateRectangleAspectRatio(
  rect: RectangleDescriptor
): number {
  if (rect.height === 0) return 1;
  return rect.width / rect.height;
}
