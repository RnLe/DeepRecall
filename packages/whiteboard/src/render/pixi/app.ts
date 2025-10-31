/**
 * PixiJS Application Initialization
 * Handles PixiJS app creation with WebGPU/WebGL2 fallback
 */

import { Application } from "pixi.js";
import type { PixiApp, PixiRendererConfig } from "./types";
import { logger } from "@deeprecall/telemetry";

const DEFAULT_RESOLUTION =
  typeof window !== "undefined" && window.devicePixelRatio
    ? window.devicePixelRatio
    : 1;

const DEFAULT_CONFIG: PixiRendererConfig = {
  preferWebGPU: true,
  backgroundColor: 0x1f2937, // Dark gray (matches canvas.ts)
  antialias: true,
  resolution: DEFAULT_RESOLUTION,
  autoDensity: true,
};

/**
 * Create PixiJS application with WebGPU/WebGL2/Canvas fallback
 */
export async function createPixiApp(
  canvas: HTMLCanvasElement,
  config: PixiRendererConfig = {}
): Promise<PixiApp | null> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const canUseWebGPU = await checkWebGPUAvailability(canvas, mergedConfig);
  const canUseWebGL = checkWebGLAvailability();

  const preferences: ("webgpu" | "webgl")[] = [];

  if (canUseWebGPU) {
    preferences.push("webgpu");
  }

  if (canUseWebGL) {
    preferences.push("webgl");
  }

  if (preferences.length === 0) {
    return null;
  }

  const errors: Error[] = [];

  for (const preference of preferences) {
    let app: Application | null = null;

    try {
      app = new Application();

      // For WebGL, PixiJS v8 will try WebGL2 first, then WebGL1
      // We need to pass additional options to ensure proper fallback
      await app.init({
        canvas,
        preference,
        backgroundColor: mergedConfig.backgroundColor,
        antialias: mergedConfig.antialias,
        resolution: mergedConfig.resolution,
        autoDensity: mergedConfig.autoDensity,
        resizeTo: undefined, // We'll handle resize manually
        // Don't fail on performance caveat
        failIfMajorPerformanceCaveat: false,
      });

      const rendererType = detectRendererType(app, preference);

      logger.info("whiteboard", "PixiJS initialized", {
        renderer: rendererType,
        resolution: mergedConfig.resolution,
      });

      return {
        app,
        stage: app.stage,
        canvas,
        renderer: rendererType,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);

      if (app) {
        try {
          app.destroy(true);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  // All renderers failed
  return null;
}

async function checkWebGPUAvailability(
  canvas: HTMLCanvasElement,
  config: PixiRendererConfig
): Promise<boolean> {
  if (!config.preferWebGPU) return false;
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    return false;
  }

  try {
    const adapter = await (
      navigator as typeof navigator & { gpu: GPU }
    ).gpu.requestAdapter();

    if (!adapter) {
      return false;
    }

    // Validate canvas context availability
    const testContext = canvas.getContext("webgpu");
    if (!testContext) {
      return false;
    }

    if (typeof testContext.unconfigure === "function") {
      testContext.unconfigure();
    }

    // Validate OffscreenCanvas support (PixiJS uses it internally)
    if (typeof OffscreenCanvas !== "undefined") {
      const offscreen = new OffscreenCanvas(1, 1);
      const offscreenContext = offscreen.getContext("webgpu");
      if (!offscreenContext) {
        return false;
      }

      if (typeof offscreenContext.unconfigure === "function") {
        offscreenContext.unconfigure();
      }
    }

    return true;
  } catch {
    return false;
  }
}

function checkWebGLAvailability(): boolean {
  if (
    typeof document === "undefined" &&
    typeof OffscreenCanvas === "undefined"
  ) {
    return false;
  }

  try {
    let gl: RenderingContext | null = null;
    let canvas: HTMLCanvasElement | OffscreenCanvas;

    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(1, 1);
      gl = canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    } else {
      canvas = document.createElement("canvas");
      gl =
        canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }) ||
        canvas.getContext("experimental-webgl");
    }

    if (!gl) {
      // Try again without performance caveat check
      if (canvas instanceof HTMLCanvasElement) {
        gl =
          canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      } else {
        gl = canvas.getContext("webgl");
      }
    }

    if (!gl) {
      return false;
    }

    // Clean up test context
    const loseContext = (gl as WebGLRenderingContext)?.getExtension(
      "WEBGL_lose_context"
    );
    loseContext?.loseContext();

    return true;
  } catch {
    return false;
  }
}

/**
 * Detect which renderer PixiJS is using
 */
function detectRendererType(
  app: Application,
  preference: "webgpu" | "webgl" | "canvas"
): "webgpu" | "webgl" | "canvas" {
  const renderer = app.renderer;

  // Check renderer type (PixiJS v8 detection)
  if ("gpu" in renderer && renderer.gpu) {
    return "webgpu";
  }

  if ("gl" in renderer && renderer.gl) {
    return "webgl";
  }

  // Pixi can silently fallback; default to the preference used
  return preference;
}

/**
 * Resize PixiJS renderer
 */
export function resizePixiApp(
  pixiApp: PixiApp,
  width: number,
  height: number
): void {
  pixiApp.app.renderer.resize(width, height);
}

/**
 * Destroy PixiJS application and clean up resources
 */
export function destroyPixiApp(pixiApp: PixiApp): void {
  try {
    pixiApp.app.destroy(true, {
      children: true,
      texture: true,
      textureSource: true,
    });
  } catch (error) {
    logger.error("whiteboard", "PixiJS cleanup error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
