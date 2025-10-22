/**
 * Coordinate conversion utilities for PDF annotations
 */

import type { NormalizedRect } from "../schemas/annotation";

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Convert pixel coordinates to normalized (0..1) coordinates
 */
export function normalizeRect(
  rect: PixelRect,
  pageWidth: number,
  pageHeight: number
): NormalizedRect {
  return {
    x: rect.x / pageWidth,
    y: rect.y / pageHeight,
    width: rect.width / pageWidth,
    height: rect.height / pageHeight,
  };
}

/**
 * Convert normalized coordinates back to pixel coordinates
 */
export function denormalizeRect(
  rect: NormalizedRect,
  pageWidth: number,
  pageHeight: number
): PixelRect {
  return {
    x: rect.x * pageWidth,
    y: rect.y * pageHeight,
    width: rect.width * pageWidth,
    height: rect.height * pageHeight,
  };
}
