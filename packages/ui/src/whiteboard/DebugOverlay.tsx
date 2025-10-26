/**
 * DebugOverlay - Performance and Stroke Visualization Tool
 * Draggable overlay showing FPS, renderer info, and stroke details
 */

"use client";

import { useState, useEffect, useRef, type MouseEvent } from "react";
import type { Tool, BrushType } from "@deeprecall/whiteboard/ink";

export interface DebugStats {
  fps: number;
  frameTime: number;
  renderer: "webgpu" | "webgl" | "canvas";
  strokeCount: number;
  pointCount: number;
  visibleStrokes: number;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  viewportWidth: number;
  viewportHeight: number;
  tool: Tool;
  brushType: BrushType;
  brushColor: string;
  brushWidth: number;
  cursorScreen: { x: number; y: number };
  cursorBoard: { x: number; y: number };
}

export interface DebugOverlayProps {
  stats: DebugStats;
  showStrokeVisualization: boolean;
  onToggleVisualization: () => void;
  onClose: () => void;
}

export function DebugOverlay({
  stats,
  showStrokeVisualization,
  onToggleVisualization,
  onClose,
}: DebugOverlayProps) {
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const getRendererColor = () => {
    switch (stats.renderer) {
      case "webgpu":
        return "text-green-400";
      case "webgl":
        return "text-blue-400";
      case "canvas":
        return "text-yellow-400";
      default:
        return "text-gray-400";
    }
  };

  const getFpsColor = () => {
    if (stats.fps >= 55) return "text-green-400";
    if (stats.fps >= 30) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div
      ref={overlayRef}
      className="fixed z-50 backdrop-blur-md bg-black/60 rounded-lg border border-white/10 shadow-2xl select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        minWidth: "280px",
        cursor: isDragging ? "grabbing" : "default",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-white/10 flex items-center justify-between cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm font-semibold text-white">Debug Stats</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
          title="Close debug overlay"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Stats Content */}
      <div className="px-4 py-3 space-y-3 text-sm">
        {/* Performance */}
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
            Performance
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-300">FPS</span>
              <span className={`font-mono font-bold ${getFpsColor()}`}>
                {stats.fps.toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Frame Time</span>
              <span className="text-white font-mono">
                {stats.frameTime.toFixed(2)}ms
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Renderer</span>
              <span
                className={`font-mono font-bold uppercase ${getRendererColor()}`}
              >
                {stats.renderer}
              </span>
            </div>
          </div>
        </div>

        {/* Objects */}
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
            Scene Objects
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-300">Total Strokes</span>
              <span className="text-white font-mono">{stats.strokeCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Total Points</span>
              <span className="text-white font-mono">
                {stats.pointCount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Visible Strokes</span>
              <span className="text-green-400 font-mono">
                {stats.visibleStrokes}
              </span>
            </div>
          </div>
        </div>

        {/* Camera */}
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
            Camera
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-300">Position</span>
              <span className="text-white font-mono text-xs">
                ({stats.cameraX.toFixed(0)}, {stats.cameraY.toFixed(0)})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Zoom</span>
              <span className="text-white font-mono">
                {(stats.cameraZoom * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Viewport</span>
              <span className="text-white font-mono text-xs">
                {stats.viewportWidth}×{stats.viewportHeight}
              </span>
            </div>
          </div>
        </div>

        {/* Current Tool */}
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
            Current Tool
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-300">Tool</span>
              <span className="text-white font-mono text-xs uppercase">
                {stats.tool}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Brush</span>
              <span className="text-white font-mono text-xs uppercase">
                {stats.brushType}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Color</span>
              <span className="flex items-center gap-2">
                <span className="text-white font-mono text-xs">
                  {stats.brushColor}
                </span>
                <span
                  className="w-3 h-3 rounded-full border border-white/30"
                  style={{ backgroundColor: stats.brushColor }}
                />
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Width</span>
              <span className="text-white font-mono">
                {stats.brushWidth.toFixed(1)}px
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Cursor (screen)</span>
              <span className="text-white font-mono text-xs">
                ({stats.cursorScreen.x.toFixed(0)},{" "}
                {stats.cursorScreen.y.toFixed(0)})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Cursor (board)</span>
              <span className="text-white font-mono text-xs">
                ({stats.cursorBoard.x.toFixed(1)},{" "}
                {stats.cursorBoard.y.toFixed(1)})
              </span>
            </div>
          </div>
        </div>

        {/* Visualization Toggle */}
        <div className="pt-2 border-t border-white/10">
          <button
            onClick={onToggleVisualization}
            className={`w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              showStrokeVisualization
                ? "bg-blue-500/20 text-blue-400 border border-blue-400/30"
                : "bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10"
            }`}
          >
            {showStrokeVisualization
              ? "Hide Stroke Visualization"
              : "Show Stroke Visualization"}
          </button>
        </div>
      </div>
    </div>
  );
}
