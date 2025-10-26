/**
 * Core - Math, Camera, Tiling
 * Fundamental types and utilities for whiteboard coordinate systems
 */

/**
 * 2D Point
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Rectangle/Bounding Box
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Transform matrix for 2D affine transforms
 */
export interface Transform {
  scale: number;
  translateX: number;
  translateY: number;
}

/**
 * Board dimensions (A4 at 96 DPI)
 */
export const BOARD_CONFIG = {
  A4_WIDTH: 794, // 210mm at 96 DPI
  A4_HEIGHT: 1123, // 297mm at 96 DPI
  GRID_SIZE: 20,
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 5,
  DEFAULT_ZOOM: 1,
} as const;

/**
 * Math utilities
 */
export const MathUtils = {
  /**
   * Linear interpolation
   */
  lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  },

  /**
   * Clamp value between min and max
   */
  clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  },

  /**
   * Distance between two points
   */
  distance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /**
   * Check if point is inside rectangle
   */
  pointInRect(point: Point, rect: Rect): boolean {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  },

  /**
   * Check if two rectangles intersect
   */
  rectsIntersect(a: Rect, b: Rect): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  },
};

/**
 * Calculate bounding box for a set of points
 */
export function calculateBoundingBox(points: Point[]): Rect {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

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
 * Expand bounding box by a margin
 */
export function expandRect(rect: Rect, margin: number): Rect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  };
}
