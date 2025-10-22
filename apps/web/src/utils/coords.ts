/**
 * Coordinate normalization utilities
 * All annotation coordinates are stored as normalized (0..1) values
 */

import type { NormalizedRect } from "@deeprecall/core/schemas/annotations";

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
