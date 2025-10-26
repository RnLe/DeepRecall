/**
 * PixiJS Renderer
 * Core renderer for strokes using PixiJS Graphics API
 */

import { Graphics, Container } from "pixi.js";
import { BOARD_CONFIG, type Point, type Transform } from "../../core/math";
import type { StrokeObject } from "../../scene/objects";
import type { StrokePoint, StrokeStyle } from "@deeprecall/core";
import type { PixiApp, StrokeGraphics, RenderStats } from "./types";
import { hexToPixiColor, calculateStrokeBounds } from "./utils";

/**
 * PixiJS Renderer for whiteboard strokes
 *
 * Responsibilities:
 * - Render strokes as PixiJS Graphics objects
 * - Manage stroke graphics cache
 * - Apply camera transforms
 * - Track render statistics
 */
export class PixiRenderer {
  private pixiApp: PixiApp;
  private rootContainer: Container;
  private boardContainer: Container;
  private backgroundContainer: Container;
  private backgroundGraphics: Graphics;
  private strokesContainer: Container;
  private overlayContainer: Container;
  private activeStrokeGraphics: Graphics | null;
  private strokeGraphicsCache: Map<string, StrokeGraphics>;
  private stats: RenderStats;
  private lastFrameTime: number;
  private frameCount: number;
  private fpsUpdateTime: number;

  constructor(pixiApp: PixiApp) {
    this.pixiApp = pixiApp;
    this.pixiApp.stage.sortableChildren = false;

    this.rootContainer = new Container();
    this.rootContainer.sortableChildren = false;
    this.pixiApp.stage.addChild(this.rootContainer);

    this.boardContainer = new Container();
    this.boardContainer.sortableChildren = true;
    this.rootContainer.addChild(this.boardContainer);

    this.backgroundContainer = new Container();
    this.backgroundContainer.sortableChildren = false;
    this.backgroundContainer.zIndex = 0;

    this.backgroundGraphics = new Graphics();
    this.backgroundContainer.addChild(this.backgroundGraphics);

    this.strokesContainer = new Container();
    this.strokesContainer.sortableChildren = false;
    this.strokesContainer.zIndex = 10;

    this.overlayContainer = new Container();
    this.overlayContainer.sortableChildren = false;
    this.overlayContainer.zIndex = 20;

    this.boardContainer.addChild(this.backgroundContainer);
    this.boardContainer.addChild(this.strokesContainer);
    this.boardContainer.addChild(this.overlayContainer);

    this.activeStrokeGraphics = null;

    this.strokeGraphicsCache = new Map();
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.fpsUpdateTime = performance.now();

    this.stats = {
      fps: 0,
      frameTime: 0,
      drawCalls: 0,
      objectCount: 0,
      textureMemory: 0,
      geometryMemory: 0,
      totalMemory: 0,
      renderer: pixiApp.renderer,
      resolution: {
        width: pixiApp.canvas.width,
        height: pixiApp.canvas.height,
      },
    };
  }

  /**
   * Clear all strokes from scene
   */
  clear(): void {
    this.backgroundGraphics.clear();
    this.strokesContainer.removeChildren();
    this.strokeGraphicsCache.clear();
  }

  /**
   * Add or update a stroke in the scene
   */
  addStroke(stroke: StrokeObject): void {
    const existing = this.strokeGraphicsCache.get(stroke.id);

    if (existing) {
      // Update existing stroke
      this.updateStrokeGraphics(existing.graphics, stroke);
      existing.bounds = calculateStrokeBounds(stroke.points);
      existing.lastUpdate = Date.now();
    } else {
      // Create new stroke graphics
      const graphics = new Graphics();
      this.renderStroke(graphics, stroke);

      const bounds = calculateStrokeBounds(stroke.points);
      const strokeGraphics: StrokeGraphics = {
        id: stroke.id,
        graphics,
        bounds,
        lastUpdate: Date.now(),
      };

      this.strokeGraphicsCache.set(stroke.id, strokeGraphics);
      this.strokesContainer.addChild(graphics);
    }
  }

  /**
   * Remove a stroke from the scene
   */
  removeStroke(strokeId: string): void {
    const strokeGraphics = this.strokeGraphicsCache.get(strokeId);
    if (strokeGraphics) {
      this.strokesContainer.removeChild(strokeGraphics.graphics);
      strokeGraphics.graphics.destroy();
      this.strokeGraphicsCache.delete(strokeId);
    }
  }

  /**
   * Render multiple strokes (bulk operation)
   */
  renderStrokes(strokes: StrokeObject[]): void {
    const incomingIds = new Set<string>();

    for (const stroke of strokes) {
      incomingIds.add(stroke.id);
      this.addStroke(stroke);
    }

    // Remove any strokes not present in the incoming list
    for (const [id] of this.strokeGraphicsCache) {
      if (!incomingIds.has(id)) {
        this.removeStroke(id);
      }
    }
  }

  /**
   * Apply camera transform to stage
   */
  applyTransform(transform: Transform, boardOffset: Point): void {
    this.rootContainer.position.set(transform.translateX, transform.translateY);
    this.rootContainer.scale.set(transform.scale, transform.scale);

    this.boardContainer.position.set(boardOffset.x, boardOffset.y);
  }

  /**
   * Render a single stroke to Graphics object
   */
  private renderStroke(graphics: Graphics, stroke: StrokeObject): void {
    graphics.clear();

    if (stroke.points.length === 0) return;

    const color = hexToPixiColor(stroke.style.color);
    const width = stroke.style.width;
    const alpha = stroke.style.opacity;

    graphics.moveTo(stroke.points[0].x, stroke.points[0].y);

    if (stroke.points.length === 1) {
      // Single point - draw as circle
      graphics.circle(stroke.points[0].x, stroke.points[0].y, width / 2);
      graphics.fill({ color, alpha });
    } else {
      // Multiple points - draw as line
      graphics.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        graphics.lineTo(stroke.points[i].x, stroke.points[i].y);
      }

      graphics.stroke({
        width,
        color,
        alpha,
        cap: "round",
        join: "round",
      });
    }
  }

  /**
   * Render board background and grid
   */
  renderBoard(backgroundColor = "#f8f7ea"): void {
    this.backgroundGraphics.clear();
    this.backgroundGraphics.position.set(0, 0);

    const fillColor = hexToPixiColor(backgroundColor);
    const gridColor = 0xe0e0e0;

    this.backgroundGraphics.rect(
      0,
      0,
      BOARD_CONFIG.A4_WIDTH,
      BOARD_CONFIG.A4_HEIGHT
    );
    this.backgroundGraphics.fill({ color: fillColor });

    // Grid lines - vertical
    for (let x = 0; x <= BOARD_CONFIG.A4_WIDTH; x += BOARD_CONFIG.GRID_SIZE) {
      this.backgroundGraphics.moveTo(x, 0);
      this.backgroundGraphics.lineTo(x, BOARD_CONFIG.A4_HEIGHT);
      this.backgroundGraphics.stroke({
        width: 0.5,
        color: gridColor,
        alpha: 1,
      });
    }

    // Grid lines - horizontal
    for (let y = 0; y <= BOARD_CONFIG.A4_HEIGHT; y += BOARD_CONFIG.GRID_SIZE) {
      this.backgroundGraphics.moveTo(0, y);
      this.backgroundGraphics.lineTo(BOARD_CONFIG.A4_WIDTH, y);
      this.backgroundGraphics.stroke({
        width: 0.5,
        color: gridColor,
        alpha: 1,
      });
    }
  }

  /**
   * Render active stroke overlay (during drawing)
   */
  setActiveStroke(points: StrokePoint[], style: StrokeStyle): void {
    if (!this.activeStrokeGraphics) {
      this.activeStrokeGraphics = new Graphics();
      this.activeStrokeGraphics.zIndex = 1;
      this.overlayContainer.addChild(this.activeStrokeGraphics);
    }

    const graphics = this.activeStrokeGraphics;
    graphics.clear();

    if (points.length === 0) return;

    const color = hexToPixiColor(style.color);
    const width = style.width;
    const alpha = style.opacity ?? 1;

    graphics.moveTo(points[0].x, points[0].y);

    if (points.length === 1) {
      graphics.circle(points[0].x, points[0].y, width / 2);
      graphics.fill({ color, alpha });
      return;
    }

    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }

    graphics.stroke({
      width,
      color,
      alpha,
      cap: "round",
      join: "round",
    });
  }

  /**
   * Clear active stroke overlay
   */
  clearActiveStroke(): void {
    if (this.activeStrokeGraphics) {
      this.activeStrokeGraphics.clear();
    }
  }

  /**
   * Update existing stroke graphics
   */
  private updateStrokeGraphics(graphics: Graphics, stroke: StrokeObject): void {
    // Re-render the stroke
    this.renderStroke(graphics, stroke);
  }

  /**
   * Update resolution metadata
   */
  updateResolution(width: number, height: number): void {
    this.stats.resolution = { width, height };
  }

  /**
   * Update render statistics
   */
  updateStats(): void {
    const now = performance.now();
    this.frameCount++;

    // Update frame time
    this.stats.frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Update FPS every 500ms
    if (now - this.fpsUpdateTime > 500) {
      this.stats.fps = Math.round(
        (this.frameCount * 1000) / (now - this.fpsUpdateTime)
      );
      this.frameCount = 0;
      this.fpsUpdateTime = now;
    }

    // Update object count
    this.stats.objectCount = this.strokeGraphicsCache.size;

    // Update draw calls (approximate)
    this.stats.drawCalls = this.strokesContainer.children.length;

    // Note: Texture/geometry memory tracking requires renderer API access
    // Will be implemented in Stage 4 with more advanced memory profiling
  }

  /**
   * Get current render statistics
   */
  getStats(): RenderStats {
    return { ...this.stats };
  }

  /**
   * Get all stroke graphics (for debugging)
   */
  getStrokeGraphics(): StrokeGraphics[] {
    return Array.from(this.strokeGraphicsCache.values());
  }

  /**
   * Enable stroke visualization (debug mode)
   * Shows stroke points, bounding boxes, and control paths
   */
  setStrokeVisualization(enabled: boolean, strokes: StrokeObject[]): void {
    if (!enabled) {
      // Remove all visualization graphics
      this.overlayContainer.children
        .filter((child) => child.label === "debug")
        .forEach((child) => child.destroy());
      return;
    }

    // Clear previous debug graphics
    this.overlayContainer.children
      .filter((child) => child.label === "debug")
      .forEach((child) => child.destroy());

    // Draw visualization for each stroke
    strokes.forEach((stroke) => {
      if (!stroke.visible || stroke.points.length === 0) return;

      const debugGraphics = new Graphics();
      debugGraphics.label = "debug";

      // Draw bounding box
      const bounds = calculateStrokeBounds(stroke.points);
      debugGraphics
        .rect(bounds.x, bounds.y, bounds.width, bounds.height)
        .stroke({ width: 1, color: 0x00ff00, alpha: 0.5 });

      // Draw stroke path (simplified)
      if (stroke.points.length > 1) {
        const first = stroke.points[0];
        debugGraphics.moveTo(first.x, first.y);

        for (let i = 1; i < stroke.points.length; i++) {
          const point = stroke.points[i];
          debugGraphics.lineTo(point.x, point.y);
        }

        debugGraphics.stroke({ width: 1, color: 0x0080ff, alpha: 0.8 });
      }

      // Draw control points
      stroke.points.forEach((point, index) => {
        const isFirst = index === 0;
        const isLast = index === stroke.points.length - 1;
        const color = isFirst ? 0x00ff00 : isLast ? 0xff0000 : 0xffff00;
        const radius = isFirst || isLast ? 4 : 2;

        debugGraphics
          .circle(point.x, point.y, radius)
          .fill({ color, alpha: 0.8 });
      });

      this.overlayContainer.addChild(debugGraphics);
    });
  }

  /**
   * Destroy renderer and clean up resources
   */
  destroy(): void {
    this.clear();
    this.rootContainer.destroy({ children: true });
    this.activeStrokeGraphics = null;
  }
}
