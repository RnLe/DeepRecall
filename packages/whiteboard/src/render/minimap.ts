/**
 * Minimap - Small overview of the board
 */

import type { Rect } from "../core/math";
import { BOARD_CONFIG } from "../core/math";
import type { StrokeObject } from "../scene/objects";

/**
 * Minimap renderer
 */
export class MinimapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.width = 150;
    this.height = 212; // A4 ratio

    canvas.width = this.width;
    canvas.height = this.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context for minimap");
    }
    this.ctx = ctx;
  }

  /**
   * Render minimap
   */
  render(strokes: StrokeObject[], viewport: Rect, scale: number): void {
    const { ctx, width, height } = this;

    // Clear
    ctx.fillStyle = "#f8f7ea";
    ctx.fillRect(0, 0, width, height);

    // Draw strokes (simplified)
    const scaleX = width / BOARD_CONFIG.A4_WIDTH;
    const scaleY = height / BOARD_CONFIG.A4_HEIGHT;

    strokes.forEach((stroke) => {
      if (!stroke.visible) return;

      ctx.strokeStyle = stroke.style.color;
      ctx.lineWidth = Math.max(0.5, stroke.style.width * scaleX);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      stroke.points.forEach((point, i) => {
        const x = point.x * scaleX;
        const y = point.y * scaleY;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    });

    // Draw viewport rectangle
    ctx.strokeStyle = "#529dff";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      viewport.x * scaleX,
      viewport.y * scaleY,
      viewport.width * scaleX,
      viewport.height * scaleY
    );
  }
}
