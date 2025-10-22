/**
 * ReaderLayout - Main layout for PDF reader
 * VSCode-style: left sidebar (files) + tab bar + content area + optional right sidebar (tools)
 */

"use client";

import { useRef, useEffect, useState } from "react";
import { useReaderUI } from "@deeprecall/data/stores";
import { FileList } from "./FileList";
import { AnnotationList } from "./AnnotationList";
import { AnnotationEditor } from "./AnnotationEditor";
import { TabBar } from "./TabBar";
import {
  PanelLeftClose,
  ChevronRight,
  FolderOpen,
  MessageSquare,
} from "lucide-react";

interface ReaderLayoutProps {
  children: React.ReactNode;
}

export function ReaderLayout({ children }: ReaderLayoutProps) {
  const {
    leftSidebarOpen,
    leftSidebarWidth,
    leftSidebarView,
    rightSidebarOpen,
    rightSidebarWidth,
    toggleLeftSidebar,
    toggleRightSidebar,
    setLeftSidebarWidth,
    setRightSidebarWidth,
    setLeftSidebarView,
    getActiveTab,
  } = useReaderUI();

  const leftResizerRef = useRef<HTMLDivElement>(null);
  const rightResizerRef = useRef<HTMLDivElement>(null);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [annotationReloadTrigger, setAnnotationReloadTrigger] = useState(0);

  const activeTab = getActiveTab();
  const activeSha256 = activeTab?.assetId || null;

  // Left sidebar resize logic
  useEffect(() => {
    if (!isResizingLeft) return;

    const handleMouseMove = (e: MouseEvent) => {
      setLeftSidebarWidth(e.clientX);
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingLeft, setLeftSidebarWidth]);

  // Right sidebar resize logic
  useEffect(() => {
    if (!isResizingRight) return;

    const handleMouseMove = (e: MouseEvent) => {
      const windowWidth = window.innerWidth;
      const newWidth = windowWidth - e.clientX;
      setRightSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingRight(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingRight, setRightSidebarWidth]);

  return (
    <div className="h-full flex bg-gray-900 relative">
      {/* Left sidebar (file list) */}
      {leftSidebarOpen && (
        <>
          <div
            className="flex-shrink-0 overflow-hidden relative flex flex-col bg-gray-900"
            style={{ width: `${leftSidebarWidth}px` }}
          >
            {/* View Toggle with collapse button */}
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setLeftSidebarView("files")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  leftSidebarView === "files"
                    ? "bg-gray-800 text-purple-400 border-b-2 border-purple-600"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                }`}
                title="Files"
              >
                <FolderOpen className="w-4 h-4" />
                Files
              </button>
              <button
                onClick={() => setLeftSidebarView("annotations")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  leftSidebarView === "annotations"
                    ? "bg-gray-800 text-purple-400 border-b-2 border-purple-600"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                }`}
                title="Annotations"
              >
                <MessageSquare className="w-4 h-4" />
                Annotations
              </button>
              {/* Collapse button in header */}
              <button
                onClick={toggleLeftSidebar}
                className="px-3 py-3 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
                title="Hide sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {leftSidebarView === "files" ? (
                <FileList />
              ) : (
                <AnnotationList
                  sha256={activeSha256}
                  reloadTrigger={annotationReloadTrigger}
                  onAnnotationUpdated={() => {
                    setAnnotationReloadTrigger((prev) => prev + 1);
                  }}
                  onAnnotationClick={(ann) => {
                    // Calculate topmost Y from annotation
                    let minY = 1;
                    if (ann.data.type === "rectangle") {
                      minY = Math.min(...ann.data.rects.map((r) => r.y));
                    } else if (ann.data.type === "highlight") {
                      minY = Math.min(
                        ...ann.data.ranges.flatMap((r) =>
                          r.rects.map((rect) => rect.y)
                        )
                      );
                    }

                    // Navigate to page with y-offset
                    const { navigateToPage } =
                      require("@/src/stores/annotation-ui").useAnnotationUI.getState();
                    navigateToPage(ann.page, minY);
                  }}
                />
              )}
            </div>
          </div>

          {/* Left resizer */}
          <div
            ref={leftResizerRef}
            onMouseDown={() => setIsResizingLeft(true)}
            className={`
                w-1 cursor-col-resize hover:bg-purple-500 transition-colors
                ${isResizingLeft ? "bg-purple-500" : "bg-transparent"}
              `}
          />
        </>
      )}

      {/* Left sidebar expand button (when collapsed) */}
      {!leftSidebarOpen && (
        <button
          onClick={toggleLeftSidebar}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 px-1.5 py-8 bg-gray-700 hover:bg-purple-600 border border-gray-600 rounded-r-lg transition-colors text-gray-300 hover:text-white shadow-lg"
          title="Show sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Center content (tabs + viewer) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TabBar />
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>

      {/* Right sidebar (tools) */}
      {rightSidebarOpen && (
        <>
          {/* Right resizer */}
          <div
            ref={rightResizerRef}
            onMouseDown={() => setIsResizingRight(true)}
            className={`
                w-1 cursor-col-resize hover:bg-purple-500 transition-colors
                ${isResizingRight ? "bg-purple-500" : "bg-transparent"}
              `}
          />

          <div
            className="flex-shrink-0 bg-gray-800 border-l border-gray-700 overflow-hidden relative"
            style={{ width: `${rightSidebarWidth}px` }}
          >
            {/* Annotation Editor */}
            <AnnotationEditor
              sha256={activeSha256 || ""}
              onAnnotationDeleted={() => {
                // Trigger reload in annotation list (handled by Dexie live query)
              }}
              onAnnotationUpdated={() => {
                // Trigger annotation reload in list and PDF
                setAnnotationReloadTrigger((prev) => prev + 1);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
