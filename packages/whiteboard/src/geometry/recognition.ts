/**
 * Geometry - Shape Recognition
 * Detects geometric shapes from freehand stroke points
 */

import type { StrokePoint } from "@deeprecall/core";
import type { ShapeDescriptor, ShapeType } from "./shapes";
import {
  fitLine,
  fitCircle,
  fitEllipse,
  fitRectangle,
  fitSquare,
  calculateLineR2,
  calculateCircleQuality,
  calculateEllipseAspectRatio,
  calculateRectangleQuality,
  calculateRectangleAspectRatio,
} from "./fitting";

/**
 * Recognition configuration
 */
export interface RecognitionConfig {
  minPoints: number; // Minimum points required
  lineThreshold: number; // R² threshold for line detection (0-1)
  circleQualityThreshold: number; // Quality threshold for circle (0-1)
  circleAspectRatioMax: number; // Max aspect ratio for circle
  ellipseAspectRatioMin: number; // Min aspect ratio for ellipse
  ellipseAspectRatioMax: number; // Max aspect ratio for ellipse
  rectangleQualityThreshold: number; // Quality threshold for rectangle
  squareAspectRatioRange: [number, number]; // [min, max] aspect ratio for square
}

/**
 * Default recognition configuration
 */
export const DEFAULT_RECOGNITION_CONFIG: RecognitionConfig = {
  minPoints: 5,
  lineThreshold: 0.95,
  circleQualityThreshold: 0.75,
  circleAspectRatioMax: 1.15,
  ellipseAspectRatioMin: 1.2,
  ellipseAspectRatioMax: 3.0,
  rectangleQualityThreshold: 0.7,
  squareAspectRatioRange: [0.85, 1.15],
};

/**
 * Recognition result with confidence
 */
export interface RecognitionResult {
  shape: ShapeDescriptor;
  confidence: number; // 0-1
  shapeType: ShapeType;
}

/**
 * Calculate total path length of stroke
 */
function calculatePathLength(points: StrokePoint[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

/**
 * Recognize shape from stroke points
 * Returns null if no shape detected with sufficient confidence
 */
export function recognizeShape(
  points: StrokePoint[],
  config: RecognitionConfig = DEFAULT_RECOGNITION_CONFIG
): ShapeDescriptor | null {
  // Sanity guard 1: Require minimum points
  if (points.length < 10) return null;

  // Sanity guard 2: Check stroke duration (reject if > 6 seconds)
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const strokeDuration = lastPoint.timestamp - firstPoint.timestamp;
  if (strokeDuration > 6000) return null; // Too long, likely not a deliberate shape

  // Sanity guard 3: Check distance between start and end
  const dx = lastPoint.x - firstPoint.x;
  const dy = lastPoint.y - firstPoint.y;
  const closureDistance = Math.sqrt(dx * dx + dy * dy);
  const strokeLength = calculatePathLength(points);

  // Determine if stroke is closed or open
  // For lines: closure distance should be >= 30% of stroke length
  // For closed shapes: closure distance should be < 20% of stroke length
  const isLikelyLine = closureDistance > strokeLength * 0.3;
  const isClosed = closureDistance < strokeLength * 0.2;

  // Strong line indicator: large absolute distance regardless of path length
  // This prevents circles/rectangles being detected for straight drags
  const hasLargeDistance = closureDistance > 100; // At least 100 pixels apart

  // Try each shape type in order of simplicity
  const results: RecognitionResult[] = [];

  // 1. Try line detection (only for clearly open strokes)
  if (isLikelyLine) {
    const lineResult = tryDetectLine(points, config);
    if (lineResult) {
      results.push(lineResult);

      // If start and end are very far apart, strongly prefer line
      if (hasLargeDistance && lineResult.confidence > 0.7) {
        return lineResult.shape; // Early return - definitely a line
      }
    }
  }

  // 2. Try circle detection (skip if clearly not closed)
  if (!hasLargeDistance) {
    const circleResult = tryDetectCircle(points, config);
    if (circleResult) {
      results.push(circleResult);
    }
  }

  // 3. Try square detection (skip if clearly not closed)
  if (!hasLargeDistance) {
    const squareResult = tryDetectSquare(points, config);
    if (squareResult) {
      results.push(squareResult);
    }
  }

  // 4. Try rectangle detection (skip if clearly not closed)
  if (!hasLargeDistance) {
    const rectangleResult = tryDetectRectangle(points, config);
    if (rectangleResult) {
      results.push(rectangleResult);
    }
  }

  // 5. Try ellipse detection
  const ellipseResult = tryDetectEllipse(points, config);
  if (ellipseResult) {
    results.push(ellipseResult);
  }

  // Return shape with highest confidence, if any
  if (results.length === 0) {
    return null;
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results[0].shape;
}

/**
 * Try to detect a line
 */
function tryDetectLine(
  points: StrokePoint[],
  config: RecognitionConfig
): RecognitionResult | null {
  const line = fitLine(points);
  const r2 = calculateLineR2(points);

  if (r2 >= config.lineThreshold) {
    return {
      shape: line,
      confidence: r2,
      shapeType: "line",
    };
  }

  return null;
}

/**
 * Try to detect a circle
 */
function tryDetectCircle(
  points: StrokePoint[],
  config: RecognitionConfig
): RecognitionResult | null {
  const circle = fitCircle(points);
  const quality = calculateCircleQuality(points, circle);

  // Check if aspect ratio is close to 1 (circle, not ellipse)
  const ellipse = fitEllipse(points);
  const aspectRatio = calculateEllipseAspectRatio(ellipse);

  if (
    quality >= config.circleQualityThreshold &&
    aspectRatio <= config.circleAspectRatioMax
  ) {
    return {
      shape: circle,
      confidence: quality,
      shapeType: "circle",
    };
  }

  return null;
}

/**
 * Try to detect an ellipse
 */
function tryDetectEllipse(
  points: StrokePoint[],
  config: RecognitionConfig
): RecognitionResult | null {
  const ellipse = fitEllipse(points);
  const aspectRatio = calculateEllipseAspectRatio(ellipse);

  // Ellipse should have aspect ratio between min and max
  if (
    aspectRatio >= config.ellipseAspectRatioMin &&
    aspectRatio <= config.ellipseAspectRatioMax
  ) {
    // Use circle quality as a proxy for ellipse quality
    const circle = fitCircle(points);
    const baseQuality = calculateCircleQuality(points, circle);

    // Penalize for deviation from circle
    const confidence = baseQuality * 0.9;

    return {
      shape: ellipse,
      confidence,
      shapeType: "ellipse",
    };
  }

  return null;
}

/**
 * Try to detect a rectangle
 */
function tryDetectRectangle(
  points: StrokePoint[],
  config: RecognitionConfig
): RecognitionResult | null {
  const rect = fitRectangle(points);
  const quality = calculateRectangleQuality(points, rect);

  if (quality >= config.rectangleQualityThreshold) {
    return {
      shape: rect,
      confidence: quality,
      shapeType: "rectangle",
    };
  }

  return null;
}

/**
 * Try to detect a square
 */
function tryDetectSquare(
  points: StrokePoint[],
  config: RecognitionConfig
): RecognitionResult | null {
  const rect = fitRectangle(points);
  const aspectRatio = calculateRectangleAspectRatio(rect);
  const quality = calculateRectangleQuality(points, rect);

  // Check if aspect ratio is close to 1 (square)
  if (
    quality >= config.rectangleQualityThreshold &&
    aspectRatio >= config.squareAspectRatioRange[0] &&
    aspectRatio <= config.squareAspectRatioRange[1]
  ) {
    const square = fitSquare(points);
    return {
      shape: square,
      confidence: quality * 1.05, // Slight boost for square over rectangle
      shapeType: "square",
    };
  }

  return null;
}

/**
 * Check if shape type is closed (requires fill)
 */
export function isClosedShape(shapeType: ShapeType): boolean {
  return shapeType !== "line";
}

/**
 * Get shape type name (user-friendly)
 */
export function getShapeTypeName(shapeType: ShapeType): string {
  switch (shapeType) {
    case "line":
      return "Line";
    case "circle":
      return "Circle";
    case "ellipse":
      return "Ellipse";
    case "rectangle":
      return "Rectangle";
    case "square":
      return "Square";
  }
}
