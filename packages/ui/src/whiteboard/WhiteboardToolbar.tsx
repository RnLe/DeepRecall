/**
 * WhiteboardToolbar - Modern toolbar with lucide icons
 */

"use client";

import { useState } from "react";
import type { ToolId } from "@deeprecall/whiteboard/ink";
import {
  Lasso,
  Pen,
  Highlighter,
  Bookmark,
  Eraser,
  Bug,
  Pencil,
} from "lucide-react";

export interface WhiteboardToolbarProps {
  toolId: ToolId;
  onToolChange: (toolId: ToolId) => void;
  brushColor: string;
  onBrushColorChange: (color: string) => void;
  brushWidth: number;
  onBrushWidthChange: (width: number) => void;
  colorPresets?: string[];
  widthPresets?: number[];
  showDebug?: boolean;
  onDebugToggle?: () => void;
}

export function WhiteboardToolbar({
  toolId,
  onToolChange,
  brushColor,
  onBrushColorChange,
  brushWidth,
  onBrushWidthChange,
  colorPresets = ["#000000", "#529dff", "#ff5252"],
  widthPresets = [1, 3, 6],
  showDebug = false,
  onDebugToggle,
}: WhiteboardToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showWidthSlider, setShowWidthSlider] = useState(false);

  const getPresetIndex = (value: number, presets: number[]) => {
    return presets.findIndex((p) => Math.abs(p - value) < 0.5);
  };

  const selectedColorIndex = colorPresets.indexOf(brushColor);
  const selectedWidthIndex = getPresetIndex(brushWidth, widthPresets);

  const handleToolClick = (newToolId: ToolId) => {
    onToolChange(newToolId);
  };

  return (
    <div className="flex items-center gap-6 px-4">
      {/* Tools Section */}
      <div className="flex items-center gap-2">
        {/* Lasso Tool */}
        <button
          onClick={() => handleToolClick("lasso")}
          className={`p-2 rounded transition-colors ${
            toolId === "lasso"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          title="Lasso Selection (L)"
        >
          <Lasso className="w-5 h-5" />
        </button>

        {/* Pen Tool */}
        <button
          onClick={() => handleToolClick("pen")}
          className={`p-2 rounded transition-colors ${
            toolId === "pen"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          title="Pen (P)"
        >
          <Pen className="w-5 h-5" />
        </button>

        {/* Pencil Tool */}
        <button
          onClick={() => handleToolClick("pencil")}
          className={`p-2 rounded transition-colors ${
            toolId === "pencil"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          title="Pencil (C)"
        >
          <Pencil className="w-5 h-5" />
        </button>

        {/* Highlighter Tool */}
        <button
          onClick={() => handleToolClick("highlighter")}
          className={`p-2 rounded transition-colors ${
            toolId === "highlighter"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          title="Highlighter (H)"
        >
          <Highlighter className="w-5 h-5" />
        </button>

        {/* Marker Tool (90° rotated bookmark) */}
        <button
          onClick={() => handleToolClick("marker")}
          className={`p-2 rounded transition-colors ${
            toolId === "marker"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          title="Marker (M)"
        >
          <Bookmark className="w-5 h-5 rotate-90" />
        </button>

        {/* Eraser Tool */}
        <button
          onClick={() => handleToolClick("vector-eraser")}
          className={`p-2 rounded transition-colors ${
            toolId === "vector-eraser" || toolId === "bitmap-eraser"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          title="Eraser (E)"
        >
          <Eraser className="w-5 h-5" />
        </button>
      </div>

      <div className="w-px h-8 bg-gray-600" />

      {/* Color Presets */}
      <div className="flex items-center gap-2 relative">
        {colorPresets.map((color, index) => (
          <button
            key={color}
            onClick={() => {
              if (index === selectedColorIndex && !showColorPicker) {
                setShowColorPicker(true);
              } else {
                onBrushColorChange(color);
                setShowColorPicker(false);
              }
            }}
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              index === selectedColorIndex
                ? "border-white scale-110"
                : "border-gray-600 hover:border-gray-400"
            }`}
            style={{ backgroundColor: color }}
            title={`Color ${index + 1}`}
          />
        ))}

        {/* Custom Color Picker */}
        {showColorPicker && (
          <div className="absolute top-full mt-2 left-0 z-50">
            <div
              className="fixed inset-0"
              onClick={() => setShowColorPicker(false)}
            />
            <div className="relative bg-gray-800 p-3 rounded shadow-lg border border-gray-700">
              <label className="text-xs text-gray-300 mb-2 block">
                Custom Color
              </label>
              <input
                type="color"
                value={brushColor}
                onChange={(e) => onBrushColorChange(e.target.value)}
                className="w-32 h-10 rounded cursor-pointer bg-gray-700 border border-gray-600"
              />
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-8 bg-gray-600" />

      {/* Width Presets */}
      <div className="flex items-center gap-2 relative">
        {widthPresets.map((width, index) => (
          <button
            key={width}
            onClick={() => {
              if (index === selectedWidthIndex && !showWidthSlider) {
                setShowWidthSlider(true);
              } else {
                onBrushWidthChange(width);
                setShowWidthSlider(false);
              }
            }}
            className={`px-2 py-2 rounded transition-colors ${
              index === selectedWidthIndex
                ? "bg-blue-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
            title={`Width ${width}px`}
          >
            <div
              className="bg-gray-300 rounded-full"
              style={{
                width: "24px",
                height: `${Math.max(2, width * 2)}px`,
              }}
            />
          </button>
        ))}

        {/* Custom Width Slider */}
        {showWidthSlider && (
          <div className="absolute top-full mt-2 left-0 z-50">
            <div
              className="fixed inset-0"
              onClick={() => setShowWidthSlider(false)}
            />
            <div className="relative bg-gray-800 p-3 rounded shadow-lg border border-gray-700 w-48">
              <label className="text-xs text-gray-300 mb-2 block">
                Custom Width: {brushWidth}px
              </label>
              <input
                type="range"
                min="1"
                max="20"
                value={brushWidth}
                onChange={(e) => onBrushWidthChange(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Debug Toggle */}
      {onDebugToggle && (
        <>
          <div className="w-px h-8 bg-gray-600" />
          <button
            onClick={onDebugToggle}
            className={`p-2 rounded transition-colors ${
              showDebug
                ? "bg-green-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
            title="Toggle Debug Overlay (D)"
          >
            <Bug className="w-5 h-5" />
          </button>
        </>
      )}
    </div>
  );
}
