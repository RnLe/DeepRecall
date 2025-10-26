/**
 * PixiJS Renderer Types
 * Type definitions for PixiJS-specific rendering
 */

import type { Application, Container, Graphics } from "pixi.js";
import type { StrokeObject } from "../../scene/objects";

/**
 * PixiJS application instance with metadata
 */
export interface PixiApp {
  app: Application;
  stage: Container;
  canvas: HTMLCanvasElement;
  renderer: "webgpu" | "webgl" | "canvas";
}

/**
 * Cached stroke graphics
 */
export interface StrokeGraphics {
  id: string;
  graphics: Graphics;
  bounds: { x: number; y: number; width: number; height: number };
  lastUpdate: number;
}

/**
 * Render statistics for debug overlay
 */
export interface RenderStats {
  fps: number;
  frameTime: number; // milliseconds
  drawCalls: number;
  objectCount: number;
  textureMemory: number; // bytes
  geometryMemory: number; // bytes
  totalMemory: number; // bytes
  renderer: "webgpu" | "webgl" | "canvas";
  resolution: { width: number; height: number };
}

/**
 * PixiJS renderer configuration
 */
export interface PixiRendererConfig {
  preferWebGPU?: boolean;
  backgroundColor?: number;
  antialias?: boolean;
  resolution?: number;
  autoDensity?: boolean;
}
