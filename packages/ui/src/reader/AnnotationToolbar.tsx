/**
 * Annotation Toolbar - Minimal embedded toolbar for PDF annotations
 * Embedded in PDFViewer navigation bar for space efficiency
 */

"use client";

import { useState, useRef, useEffect } from "react";
import {
  MousePointer,
  Square,
  Highlighter,
  Save,
  X,
  FunctionSquare,
  Table2,
  Image,
  BookOpen,
  Lightbulb,
  CheckSquare,
  Shield,
  Beaker,
  StickyNote,
  HelpCircle,
} from "lucide-react";
import {
  useAnnotationUI,
  hasActiveSelection,
} from "@deeprecall/data/stores";

const ANNOTATION_KINDS = [
  { name: "Equation", icon: FunctionSquare },
  { name: "Table", icon: Table2 },
  { name: "Figure", icon: Image },
  { name: "Abstract", icon: BookOpen },
  { name: "Definition", icon: Lightbulb },
  { name: "Theorem", icon: CheckSquare },
  { name: "Proof", icon: Shield },
  { name: "Example", icon: Beaker },
  { name: "Note", icon: StickyNote },
  { name: "Question", icon: HelpCircle },
];

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
  const {
    tool,
    setTool,
    selection,
    setSelection,
    selectedKind,
    setSelectedKind,
  } = useAnnotationUI();
  const hasSelection = hasActiveSelection(useAnnotationUI.getState());
  const [showKindPicker, setShowKindPicker] = useState(false);
  const kindPickerRef = useRef<HTMLDivElement>(null);

  // Close kind picker when clicking outside
  useEffect(() => {
    if (!showKindPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        kindPickerRef.current &&
        !kindPickerRef.current.contains(e.target as Node)
      ) {
        setShowKindPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showKindPicker]);

  const selectedKindData =
    ANNOTATION_KINDS.find((k) => k.name === selectedKind) ||
    ANNOTATION_KINDS[2]; // Default to Figure
  const SelectedKindIcon = selectedKindData.icon;

  // Helper to get simplified icon paths for cursor (scaled for larger icon)
  function getKindIconPath(kind: string): string {
    const iconPaths: Record<string, string> = {
      Equation:
        '<text x="9" y="12" font-size="10" fill="white" font-weight="bold" text-anchor="middle">f</text>',
      Table:
        '<rect x="5" y="5" width="8" height="8" fill="none" stroke="white" stroke-width="1.2"/><line x1="9" y1="5" x2="9" y2="13" stroke="white" stroke-width="1.2"/><line x1="5" y1="9" x2="13" y2="9" stroke="white" stroke-width="1.2"/>',
      Figure:
        '<rect x="5.5" y="6" width="7" height="6" fill="none" stroke="white" stroke-width="1.2" rx="0.7"/><circle cx="7.5" cy="8" r="1" fill="white"/><polyline points="5.5,12 7.5,9.5 9,11 12.5,7.5" fill="none" stroke="white" stroke-width="1.2"/>',
      Abstract:
        '<path d="M6,12 L6,6 C6,5.5 6.5,5 7,5 L10,5 C10.5,5 11,5.5 11,6 L11,8" fill="none" stroke="white" stroke-width="1.2"/><line x1="6.5" y1="8.5" x2="10.5" y2="8.5" stroke="white" stroke-width="0.9"/><line x1="6.5" y1="10.5" x2="9.5" y2="10.5" stroke="white" stroke-width="0.9"/>',
      Definition:
        '<circle cx="9" cy="7.5" r="3" fill="none" stroke="white" stroke-width="1.2"/><line x1="9" y1="7.5" x2="9" y2="9" stroke="white" stroke-width="1.2"/><line x1="7.5" y1="11" x2="10.5" y2="12.5" stroke="white" stroke-width="1.2"/><line x1="10.5" y1="11" x2="7.5" y2="12.5" stroke="white" stroke-width="1.2"/>',
      Theorem:
        '<rect x="5.5" y="6" width="7" height="6" fill="none" stroke="white" stroke-width="1.2" rx="0.7"/><polyline points="6.5,9 8,10.5 11.5,7.5" fill="none" stroke="white" stroke-width="1.2"/>',
      Proof:
        '<path d="M9,5 L12,9 L9,13 L6,9 Z" fill="none" stroke="white" stroke-width="1.2"/><line x1="8" y1="9" x2="10" y2="9" stroke="white" stroke-width="0.9"/>',
      Example:
        '<path d="M6,10.5 L6,7.5 C6,6 7.5,5.5 9,5.5 C10.5,5.5 12,6 12,7.5 C12,8.5 11,9.5 10,10.5 L9,11.5 L9,13" fill="none" stroke="white" stroke-width="1.2"/>',
      Note: '<rect x="6" y="5" width="6" height="8" fill="none" stroke="white" stroke-width="1.2" rx="0.5"/><line x1="6.5" y1="7" x2="11.5" y2="7" stroke="white" stroke-width="0.8"/><line x1="6.5" y1="9" x2="11.5" y2="9" stroke="white" stroke-width="0.8"/><line x1="6.5" y1="11" x2="10" y2="11" stroke="white" stroke-width="0.8"/>',
      Question:
        '<circle cx="9" cy="7.5" r="3.5" fill="none" stroke="white" stroke-width="1.2"/><text x="9" y="10" font-size="6" fill="white" font-weight="bold" text-anchor="middle">?</text>',
    };
    return iconPaths[kind] || iconPaths.Figure;
  }

  return (
    <div className="flex items-center gap-2 border-l border-gray-700 pl-3 ml-3">
      {/* Tool Selector */}
      <div className="flex items-center gap-1 bg-gray-800 rounded-md p-1">
        <button
          onClick={() => setTool(tool === "rectangle" ? "pan" : "rectangle")}
          className={`p-1.5 rounded transition-colors ${
            tool === "rectangle"
              ? "text-white"
              : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
          }`}
          style={
            tool === "rectangle"
              ? { backgroundColor: selection.color }
              : undefined
          }
          title="Rectangle (R)"
        >
          <Square className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTool(tool === "highlight" ? "pan" : "highlight")}
          className={`p-1.5 rounded transition-colors ${
            tool === "highlight"
              ? "text-white"
              : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
          }`}
          style={
            tool === "highlight"
              ? { backgroundColor: selection.color }
              : undefined
          }
          title="Highlight (H)"
        >
          <Highlighter className="w-4 h-4" />
        </button>
        <div className="relative" ref={kindPickerRef}>
          <button
            onClick={() => {
              if (tool === "kind-rectangle") {
                // Already active - toggle picker or deselect
                if (showKindPicker) {
                  setShowKindPicker(false);
                } else {
                  setShowKindPicker(true);
                }
              } else {
                // Not active - just select the tool without opening picker
                setTool("kind-rectangle");
              }
            }}
            className={`p-1.5 rounded transition-colors ${
              tool === "kind-rectangle"
                ? "text-white"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
            }`}
            style={
              tool === "kind-rectangle"
                ? { backgroundColor: selection.color }
                : undefined
            }
            title={`Kind Rectangle: ${selectedKind}`}
          >
            <SelectedKindIcon className="w-4 h-4" />
          </button>
          {showKindPicker && tool === "kind-rectangle" && (
            <div className="absolute top-full mt-1 right-0 bg-gray-800 border border-gray-600 rounded-lg p-2 shadow-xl z-50 min-w-max">
              <div className="grid grid-cols-5 gap-1 w-max">
                {ANNOTATION_KINDS.map((kind) => {
                  const KindIcon = kind.icon;
                  return (
                    <button
                      key={kind.name}
                      onClick={() => {
                        setSelectedKind(kind.name);
                        setShowKindPicker(false);
                      }}
                      className={`flex flex-col items-center gap-1 p-2 rounded transition-colors hover:bg-gray-700 w-16 ${
                        selectedKind === kind.name
                          ? "bg-purple-600/30 ring-1 ring-purple-500"
                          : ""
                      }`}
                      title={kind.name}
                    >
                      <KindIcon className="w-5 h-5 text-gray-300" />
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {kind.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Color Grid - 2x3 grid with no gaps */}
      <div className="grid grid-cols-3 grid-rows-2 rounded overflow-hidden border border-gray-600">
        {COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => setSelection({ color: color.value })}
            className={`w-5 h-3 transition-all hover:brightness-110 ${
              selection.color === color.value
                ? "ring-2 ring-white ring-inset"
                : ""
            }`}
            style={{ backgroundColor: color.value }}
            title={color.name}
          />
        ))}
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
