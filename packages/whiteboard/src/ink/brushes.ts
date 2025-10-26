/**
 * Brushes - Stroke Style and Pressure Mapping
 */

import type { PointerSample } from "./input";

export type BrushType = "pen" | "highlighter" | "marker" | "eraser";

/**
 * Brush configuration
 */
export interface BrushConfig {
  type: BrushType;
  color: string;
  baseWidth: number; // Base width in world units
  opacity: number;
  pressureSensitivity: number; // 0-1, how much pressure affects width
}

/**
 * Default brush presets
 */
export const BRUSH_PRESETS: Record<BrushType, Partial<BrushConfig>> = {
  pen: {
    type: "pen",
    color: "#000000",
    baseWidth: 2,
    opacity: 1,
    pressureSensitivity: 0.5,
  },
  highlighter: {
    type: "highlighter",
    color: "#ffff00",
    baseWidth: 8,
    opacity: 0.4,
    pressureSensitivity: 0.2,
  },
  marker: {
    type: "marker",
    color: "#0000ff",
    baseWidth: 4,
    opacity: 0.8,
    pressureSensitivity: 0.3,
  },
  eraser: {
    type: "eraser",
    color: "#ffffff",
    baseWidth: 20,
    opacity: 1,
    pressureSensitivity: 0,
  },
};

/**
 * Calculate effective stroke width based on pressure
 */
export function calculateStrokeWidth(
  sample: PointerSample,
  config: BrushConfig
): number {
  const { baseWidth, pressureSensitivity } = config;
  const pressureMultiplier = 1 + (sample.pressure - 0.5) * pressureSensitivity;
  return baseWidth * pressureMultiplier;
}

/**
 * Calculate stroke color/opacity based on brush type
 */
export function calculateStrokeStyle(config: BrushConfig): {
  color: string;
  opacity: number;
} {
  return {
    color: config.color,
    opacity: config.opacity,
  };
}
