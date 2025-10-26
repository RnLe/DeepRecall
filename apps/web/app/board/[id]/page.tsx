/**
 * Board Page - Canvas for note-taking
 * Displays a drawing canvas for the specified board
 */

"use client";

import { use, useState } from "react";
import { useBoard } from "@deeprecall/data";
import {
  WhiteboardView,
  WhiteboardToolbar,
  type Tool,
  type BrushType,
} from "@deeprecall/ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: board, isLoading, error } = useBoard(id);

  // Toolbar state
  const [tool, setTool] = useState<Tool>("pen");
  const [brushType, setBrushType] = useState<BrushType>("pen");
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushWidth, setBrushWidth] = useState(3);

  // Redirect if board not found
  useEffect(() => {
    if (!isLoading && !board && !error) {
      console.error(`Board ${id} not found`);
      router.push("/");
    }
  }, [isLoading, board, error, id, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading board...</div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg text-red-600">Board not found</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header with Navigation, Title, and Toolbar */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-gray-700 bg-gray-800">
        <button
          onClick={() => router.push("/board")}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          ← Back
        </button>
        <span className="text-gray-600">|</span>
        <h1 className="text-xl font-bold text-white">{board.title}</h1>

        {/* Toolbar inline with header */}
        <div className="flex-1">
          <WhiteboardToolbar
            tool={tool}
            onToolChange={setTool}
            brushType={brushType}
            onBrushTypeChange={setBrushType}
            brushColor={brushColor}
            onBrushColorChange={setBrushColor}
            brushWidth={brushWidth}
            onBrushWidthChange={setBrushWidth}
          />
        </div>
      </header>

      {/* Whiteboard Canvas */}
      <main className="flex-1 overflow-hidden">
        <WhiteboardView
          boardId={id}
          tool={tool}
          onToolChange={setTool}
          brushColor={brushColor}
          brushWidth={brushWidth}
          brushType={brushType}
        />
      </main>
    </div>
  );
}
