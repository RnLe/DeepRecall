/**
 * Rendering utilities for smooth stroke visualization
 * This handles VISUAL smoothing (curve rendering), separate from geometric smoothing
 */

import type { StrokePoint } from "./inking";

/**
 * Render a stroke with smooth curves between points
 * Uses quadratic Bezier curves for smooth visual interpolation
 */
export function renderSmoothStroke(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  color: string,
  baseWidth: number,
  opacity: number
): void {
  if (points.length === 0) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = opacity;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (points.length === 1) {
    // Single point: draw a dot
    const p = points[0];
    const width = baseWidth;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (points.length === 2) {
    // Two points: draw a straight line
    const p0 = points[0];
    const p1 = points[1];
    ctx.lineWidth = baseWidth;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Three or more points: use quadratic curves for smooth rendering
  // Note: For variable width, we need to draw segments separately
  // For now, use average width for simplicity
  ctx.lineWidth = baseWidth;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  // Use quadratic curves with midpoints as control points
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];

    // Compute midpoint between current and next point
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;

    // Draw quadratic curve to midpoint using current point as control
    ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
  }

  // Draw final segment to last point
  const lastPoint = points[points.length - 1];
  ctx.lineTo(lastPoint.x, lastPoint.y);
  ctx.stroke();

  ctx.restore();
}

/**
 * Render a stroke with Catmull-Rom curve rendering
 * Provides even smoother curves than quadratic Bezier
 */
export function renderCatmullRomStroke(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  color: string,
  baseWidth: number,
  opacity: number,
  tension: number = 0.5
): void {
  if (points.length === 0) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = opacity;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (points.length === 1) {
    // Single point: draw a dot
    const p = points[0];
    const width = p.width ?? baseWidth;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (points.length === 2) {
    // Two points: draw a straight line
    const p0 = points[0];
    const p1 = points[1];
    ctx.lineWidth = p0.width ?? baseWidth;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Catmull-Rom curve rendering
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    // Compute Catmull-Rom control points
    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    ctx.lineWidth = p1.width ?? baseWidth;
  }

  ctx.stroke();
  ctx.restore();
}

/**
 * Render stroke with variable width along the path
 * Draws individual segments with proper width transitions
 */
export function renderVariableWidthStroke(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  color: string,
  baseWidth: number,
  opacity: number
): void {
  if (points.length === 0) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (points.length === 1) {
    const p = points[0];
    const width = p.width ?? baseWidth;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Draw each segment with its width
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const width = p0.width ?? baseWidth;

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);

    if (i < points.length - 2) {
      // Use quadratic curve for smoother transitions
      const p2 = points[i + 2];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    } else {
      // Last segment: straight line to end
      ctx.lineTo(p1.x, p1.y);
    }

    ctx.stroke();
  }

  ctx.restore();
}
