/**
 * Camera - Pan & Zoom System
 * Manages viewport transformation and coordinate conversion
 */

import { BOARD_CONFIG } from "./math";
import type { Point, Transform } from "./math";

export interface CameraState {
  scale: number;
  panOffset: Point;
}

export interface Viewport {
  width: number;
  height: number;
}

/**
 * Camera class for managing pan and zoom
 */
export class Camera {
  private state: CameraState;
  private viewport: Viewport;

  constructor(viewport: Viewport, initialState?: Partial<CameraState>) {
    this.viewport = viewport;
    this.state = {
      scale: initialState?.scale ?? BOARD_CONFIG.DEFAULT_ZOOM,
      panOffset: initialState?.panOffset ?? { x: 0, y: 0 },
    };
  }

  /**
   * Get current camera state
   */
  getState(): CameraState {
    return { ...this.state };
  }

  /**
   * Set camera state
   */
  setState(state: Partial<CameraState>): void {
    if (state.scale !== undefined) {
      this.state.scale = this.clampZoom(state.scale);
    }
    if (state.panOffset !== undefined) {
      this.state.panOffset = { ...state.panOffset };
    }
  }

  /**
   * Update viewport dimensions
   */
  setViewport(viewport: Viewport): void {
    this.viewport = { ...viewport };
  }

  /**
   * Convert screen coordinates to board coordinates
   */
  screenToBoard(screenX: number, screenY: number): Point {
    const boardOffsetX =
      (this.viewport.width / this.state.scale - BOARD_CONFIG.A4_WIDTH) / 2;
    const boardOffsetY =
      (this.viewport.height / this.state.scale - BOARD_CONFIG.A4_HEIGHT) / 2;

    const x =
      (screenX - this.state.panOffset.x) / this.state.scale - boardOffsetX;
    const y =
      (screenY - this.state.panOffset.y) / this.state.scale - boardOffsetY;

    return { x, y };
  }

  /**
   * Convert board coordinates to screen coordinates
   */
  boardToScreen(boardX: number, boardY: number): Point {
    const boardOffsetX =
      (this.viewport.width / this.state.scale - BOARD_CONFIG.A4_WIDTH) / 2;
    const boardOffsetY =
      (this.viewport.height / this.state.scale - BOARD_CONFIG.A4_HEIGHT) / 2;

    const x =
      (boardX + boardOffsetX) * this.state.scale + this.state.panOffset.x;
    const y =
      (boardY + boardOffsetY) * this.state.scale + this.state.panOffset.y;

    return { x, y };
  }

  /**
   * Pan the camera by delta (in screen pixels)
   */
  pan(dx: number, dy: number): void {
    this.state.panOffset.x += dx;
    this.state.panOffset.y += dy;
  }

  /**
   * Zoom at a specific screen point (keeps that point under the cursor)
   */
  zoomAt(screenPoint: Point, zoomFactor: number): void {
    const oldScale = this.state.scale;
    const newScale = this.clampZoom(oldScale * zoomFactor);

    // Get old and new board offsets (these change with scale)
    const oldBoardOffsetX =
      (this.viewport.width / oldScale - BOARD_CONFIG.A4_WIDTH) / 2;
    const oldBoardOffsetY =
      (this.viewport.height / oldScale - BOARD_CONFIG.A4_HEIGHT) / 2;
    const newBoardOffsetX =
      (this.viewport.width / newScale - BOARD_CONFIG.A4_WIDTH) / 2;
    const newBoardOffsetY =
      (this.viewport.height / newScale - BOARD_CONFIG.A4_HEIGHT) / 2;

    // Convert screen point to board coordinates (accounting for old board offset)
    const boardX =
      (screenPoint.x - this.state.panOffset.x) / oldScale - oldBoardOffsetX;
    const boardY =
      (screenPoint.y - this.state.panOffset.y) / oldScale - oldBoardOffsetY;

    // Calculate new pan offset to keep the same board point under the cursor
    this.state.panOffset.x =
      screenPoint.x - (boardX + newBoardOffsetX) * newScale;
    this.state.panOffset.y =
      screenPoint.y - (boardY + newBoardOffsetY) * newScale;
    this.state.scale = newScale;
  }

  /**
   * Get transform for rendering
   */
  getTransform(): Transform {
    return {
      scale: this.state.scale,
      translateX: this.state.panOffset.x,
      translateY: this.state.panOffset.y,
    };
  }

  /**
   * Get board offset for centering
   */
  getBoardOffset(): Point {
    return {
      x: (this.viewport.width / this.state.scale - BOARD_CONFIG.A4_WIDTH) / 2,
      y: (this.viewport.height / this.state.scale - BOARD_CONFIG.A4_HEIGHT) / 2,
    };
  }

  /**
   * Clamp zoom level to valid range
   */
  private clampZoom(zoom: number): number {
    return Math.max(
      BOARD_CONFIG.MIN_ZOOM,
      Math.min(BOARD_CONFIG.MAX_ZOOM, zoom)
    );
  }
}
