/**
 * Board Page - Mobile (Capacitor)
 * Canvas for note-taking with Apple Pencil support
 */

"use client";

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useBoard } from "@deeprecall/data";
import { WhiteboardView, WhiteboardToolbar, type ToolId } from "@deeprecall/ui";

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: board, isLoading, error } = useBoard(id!);

  // Toolbar state
  const [toolId, setToolId] = useState<ToolId>("pen");
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushWidth, setBrushWidth] = useState(3);
  const [showDebug, setShowDebug] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);

  // Redirect if board not found
  useEffect(() => {
    if (!isLoading && !board && !error) {
      console.error(`Board ${id} not found`);
      navigate("/board");
    }
  }, [isLoading, board, error, id, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950">
        <div className="text-lg text-gray-400">Loading board...</div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950">
        <div className="text-lg text-red-400">Board not found</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header with Navigation and Title */}
      <header className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-900/95 backdrop-blur pt-safe">
        <button
          onClick={() => navigate("/board")}
          className="text-sm text-gray-400 hover:text-gray-200 active:text-gray-100 transition-colors px-2 py-1"
        >
          ← Back
        </button>
        <span className="text-gray-700">|</span>
        <h1 className="text-lg font-bold text-white truncate flex-1">
          {board.title}
        </h1>

        {/* Toolbar Toggle (mobile) */}
        <button
          onClick={() => setShowToolbar(!showToolbar)}
          className="sm:hidden text-gray-400 hover:text-gray-200 active:text-gray-100 transition-colors p-2"
          aria-label="Toggle toolbar"
        >
          {showToolbar ? "Hide Tools" : "Show Tools"}
        </button>
      </header>

      {/* Toolbar - Collapsible on mobile, always visible on tablet/desktop */}
      {(showToolbar || window.innerWidth >= 640) && (
        <div className="shrink-0 border-b border-gray-800 bg-gray-900/90 backdrop-blur px-4 py-2">
          <WhiteboardToolbar
            toolId={toolId}
            onToolChange={setToolId}
            brushColor={brushColor}
            onBrushColorChange={setBrushColor}
            brushWidth={brushWidth}
            onBrushWidthChange={setBrushWidth}
            showDebug={showDebug}
            onDebugToggle={() => setShowDebug(!showDebug)}
          />
        </div>
      )}

      {/* Whiteboard Canvas - Full screen with touch support */}
      <main className="flex-1 overflow-hidden relative">
        <WhiteboardView
          boardId={id!}
          toolId={toolId}
          onToolChange={setToolId}
          brushColor={brushColor}
          brushWidth={brushWidth}
          showDebug={showDebug}
          onDebugClose={() => setShowDebug(false)}
        />

        {/* Palm rejection indicator (iOS) */}
        {typeof window !== "undefined" &&
          /iPad|iPhone|iPod/.test(navigator.userAgent) && (
            <div className="absolute top-4 right-4 text-xs text-gray-500 bg-gray-900/50 backdrop-blur px-3 py-1 rounded-full pointer-events-none">
              Apple Pencil Ready
            </div>
          )}
      </main>
    </div>
  );
}
