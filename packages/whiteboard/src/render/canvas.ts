/**
 * Render Module - Canvas 2D Rendering (Placeholder for PixiJS)
 * Note: This is a simplified Canvas 2D implementation.
 * Future: Replace with PixiJS WebGPU/WebGL2 renderer
 */

import type { Point, Rect } from "../core/math";
import type { Transform } from "../core/math";
import { BOARD_CONFIG } from "../core/math";
import type { StrokeObject, AnySceneObject } from "../scene/objects";

/**
 * Rendering context
 */
export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

/**
 * Create rendering context
 */
export function createRenderContext(
  canvas: HTMLCanvasElement
): RenderContext | null {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;

  return {
    canvas,
    ctx,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Clear canvas with background color
 */
export function clearCanvas(
  renderCtx: RenderContext,
  color: string = "#1f2937"
): void {
  const { ctx, width, height } = renderCtx;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Apply transform (pan & zoom)
 */
export function applyTransform(
  renderCtx: RenderContext,
  transform: Transform
): void {
  const { ctx } = renderCtx;
  ctx.save();
  ctx.translate(transform.translateX, transform.translateY);
  ctx.scale(transform.scale, transform.scale);
}

/**
 * Restore transform
 */
export function restoreTransform(renderCtx: RenderContext): void {
  renderCtx.ctx.restore();
}

/**
 * Draw board background and grid
 */
export function drawBoard(
  renderCtx: RenderContext,
  boardOffset: Point,
  backgroundColor: string = "#f8f7ea"
): void {
  const { ctx } = renderCtx;

  ctx.translate(boardOffset.x, boardOffset.y);

  // Board background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, BOARD_CONFIG.A4_WIDTH, BOARD_CONFIG.A4_HEIGHT);

  // Grid
  ctx.strokeStyle = "#e0e0e0";
  ctx.lineWidth = 0.5;

  // Vertical lines
  for (let x = 0; x <= BOARD_CONFIG.A4_WIDTH; x += BOARD_CONFIG.GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, BOARD_CONFIG.A4_HEIGHT);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = 0; y <= BOARD_CONFIG.A4_HEIGHT; y += BOARD_CONFIG.GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(BOARD_CONFIG.A4_WIDTH, y);
    ctx.stroke();
  }
}

/**
 * Draw smooth curve through points using cubic interpolation
 */
export function drawSmoothStroke(
  renderCtx: RenderContext,
  points: Point[],
  style: { color: string; width: number; opacity: number }
): void {
  const { ctx } = renderCtx;

  if (points.length === 0) return;

  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = style.opacity;

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, style.width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (points.length === 2) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    return;
  }

  // Catmull-Rom spline
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Draw a stroke object
 */
export function drawStroke(
  renderCtx: RenderContext,
  stroke: StrokeObject
): void {
  drawSmoothStroke(renderCtx, stroke.points, {
    color: stroke.style.color,
    width: stroke.style.width,
    opacity: stroke.style.opacity,
  });
}

/**
 * Draw any scene object
 */
export function drawObject(
  renderCtx: RenderContext,
  obj: AnySceneObject
): void {
  if (!obj.visible) return;

  switch (obj.kind) {
    case "stroke":
      drawStroke(renderCtx, obj);
      break;

    // TODO: Implement other object types (image, pdf, text, etc.)
    default:
      // Draw bounding box as placeholder
      const { ctx } = renderCtx;
      ctx.strokeStyle = "#cccccc";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        obj.boundingBox.x,
        obj.boundingBox.y,
        obj.boundingBox.width,
        obj.boundingBox.height
      );
  }
}
