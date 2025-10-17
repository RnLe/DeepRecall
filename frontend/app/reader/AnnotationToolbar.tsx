/**
 * Annotation Toolbar - Minimal embedded toolbar for PDF annotations
 * Embedded in PDFViewer navigation bar for space efficiency
 */

"use client";

import { MousePointer, Square, Highlighter, Save, X } from "lucide-react";
import {
  useAnnotationUI,
  hasActiveSelection,
} from "@/src/stores/annotation-ui";
import { useState } from "react";

const COLORS = [
  { name: "Amber", value: "#fbbf24", bg: "bg-amber-400" },
  { name: "Purple", value: "#c084fc", bg: "bg-purple-400" },
  { name: "Blue", value: "#60a5fa", bg: "bg-blue-400" },
  { name: "Green", value: "#4ade80", bg: "bg-green-400" },
  { name: "Red", value: "#f87171", bg: "bg-red-400" },
  { name: "Pink", value: "#f472b6", bg: "bg-pink-400" },
];

interface AnnotationToolbarProps {
  onSave: () => void;
  onCancel: () => void;
}

export function AnnotationToolbar({
  onSave,
  onCancel,
}: AnnotationToolbarProps) {
  const { tool, setTool, selection, setSelection } = useAnnotationUI();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const hasSelection = hasActiveSelection(useAnnotationUI.getState());

  return (
    <div className="flex items-center gap-2 border-l border-gray-700 pl-3 ml-3">
      {/* Tool Selector */}
      <div className="flex items-center gap-1 bg-gray-800 rounded-md p-1">
        <button
          onClick={() => setTool("pan")}
          className={`p-1.5 rounded transition-colors ${
            tool === "pan"
              ? "bg-purple-600 text-white"
              : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
          }`}
          title="Pan (V)"
        >
          <MousePointer className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTool("rectangle")}
          className={`p-1.5 rounded transition-colors ${
            tool === "rectangle"
              ? "bg-purple-600 text-white"
              : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
          }`}
          title="Rectangle (R)"
        >
          <Square className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTool("highlight")}
          className={`p-1.5 rounded transition-colors ${
            tool === "highlight"
              ? "bg-purple-600 text-white"
              : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
          }`}
          title="Highlight (H)"
        >
          <Highlighter className="w-4 h-4" />
        </button>
      </div>

      {/* Color Picker */}
      <div className="relative">
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="w-8 h-8 rounded border-2 border-gray-600 hover:border-gray-500 transition-colors"
          style={{ backgroundColor: selection.color }}
          title="Choose color"
        />
        {showColorPicker && (
          <div className="absolute top-full mt-2 right-0 bg-gray-800 border border-gray-700 rounded-md shadow-lg p-3 z-50">
            <div className="grid grid-cols-2 gap-3">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => {
                    setSelection({ color: color.value });
                    setShowColorPicker(false);
                  }}
                  className={`w-10 h-10 rounded ${color.bg} hover:scale-110 transition-transform ${
                    selection.color === color.value ? "ring-2 ring-white" : ""
                  }`}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save/Cancel (only shown when there's an active selection) */}
      {hasSelection && (
        <>
          <div className="w-px h-6 bg-gray-700" />
          <button
            onClick={onSave}
            className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded flex items-center gap-1.5 transition-colors"
            title="Save annotation"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded flex items-center gap-1.5 transition-colors"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
