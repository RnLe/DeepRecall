/**
 * Annotation List - Shows all annotations for current PDF
 * Lives in left sidebar with toggle between Files/Annotations
 */

"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/db/dexie";
import { useAnnotationUI } from "@/src/stores/annotation-ui";
import { useReaderUI } from "@/src/stores/reader-ui";
import type { Annotation } from "@/src/schema/annotation";
import { Square, Highlighter, FileQuestion } from "lucide-react";
import { AnnotationContextMenu } from "./AnnotationContextMenu";

interface AnnotationListProps {
  /** Current PDF SHA-256 */
  sha256: string | null;
  /** Callback when annotation clicked - scroll to page */
  onAnnotationClick?: (annotation: Annotation) => void;
  /** Trigger to reload annotations */
  reloadTrigger?: number;
  /** Callback when annotation is updated */
  onAnnotationUpdated?: () => void;
}

export function AnnotationList({
  sha256,
  onAnnotationClick,
  reloadTrigger,
  onAnnotationUpdated,
}: AnnotationListProps) {
  const { selectedAnnotationId, setSelectedAnnotationId, navigateToPage } =
    useAnnotationUI();
  const { rightSidebarOpen, toggleRightSidebar } = useReaderUI();

  // Live query from Dexie - auto-updates when annotations change
  const annotations = useLiveQuery(() => {
    if (!sha256) return [];
    return db.annotations.where("sha256").equals(sha256).sortBy("createdAt");
  }, [sha256, reloadTrigger]);

  const handleAnnotationClick = (annotation: Annotation) => {
    setSelectedAnnotationId(annotation.id);

    // Calculate topmost Y position from annotation geometry
    let minY = 1;
    if (annotation.data.type === "rectangle") {
      minY = Math.min(...annotation.data.rects.map((r) => r.y));
    } else if (annotation.data.type === "highlight") {
      minY = Math.min(
        ...annotation.data.ranges.flatMap((r) => r.rects.map((rect) => rect.y))
      );
    }

    onAnnotationClick?.(annotation);
  };

  if (!sha256) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 p-6">
        <FileQuestion className="w-12 h-12 mb-3 text-gray-600" />
        <p className="text-sm text-center text-gray-400">
          Open a PDF to view annotations
        </p>
      </div>
    );
  }

  if (!annotations) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  if (annotations.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 p-6">
        <Square className="w-12 h-12 mb-3 text-gray-600" />
        <p className="text-sm text-center text-gray-400">No annotations yet</p>
        <p className="text-xs text-center text-gray-500 mt-1">
          Use the tools to create annotations
        </p>
      </div>
    );
  }

  // Group by page
  const annotationsByPage = annotations.reduce(
    (acc, ann) => {
      if (!acc[ann.page]) acc[ann.page] = [];
      acc[ann.page].push(ann);
      return acc;
    },
    {} as Record<number, Annotation[]>
  );

  const pages = Object.keys(annotationsByPage)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200">
          Annotations ({annotations.length})
        </h3>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {pages.map((pageNum) => (
          <div key={pageNum} className="border-b border-gray-800">
            {/* Page header */}
            <div className="px-4 py-2 bg-gray-800/50 text-xs font-medium text-gray-400 sticky top-0">
              Page {pageNum} ({annotationsByPage[pageNum].length})
            </div>

            {/* Annotations for this page */}
            <div className="divide-y divide-gray-800">
              {annotationsByPage[pageNum].map((annotation) => {
                const isSelected = annotation.id === selectedAnnotationId;
                const color = annotation.metadata?.color || "#fbbf24";
                const kind = annotation.metadata?.kind;

                return (
                  <div
                    key={annotation.id}
                    data-annotation-list-item={annotation.id}
                    onClick={() => handleAnnotationClick(annotation)}
                    onDoubleClick={() => {
                      setSelectedAnnotationId(annotation.id);
                      if (!rightSidebarOpen) {
                        toggleRightSidebar();
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Trigger context menu click on the actual button
                      const menuButton = e.currentTarget.querySelector(
                        "button[data-context-menu-trigger]"
                      ) as HTMLButtonElement | null;
                      menuButton?.click();
                    }}
                    className={`relative w-full px-3 py-2 text-left hover:bg-gray-800 transition-colors cursor-pointer group ${
                      isSelected
                        ? "bg-gray-800 border-l-2 border-purple-600"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Icon */}
                      <div
                        className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        {annotation.data.type === "rectangle" ? (
                          <Square className="w-3.5 h-3.5" />
                        ) : (
                          <Highlighter className="w-3.5 h-3.5" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Title line with kind badge */}
                        <div className="flex items-center gap-1.5">
                          {kind && (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-700/50 border border-gray-600/50 rounded text-[9px] text-gray-400 font-medium flex-shrink-0">
                              {kind}
                            </span>
                          )}
                          <span className="text-xs font-medium text-gray-200 truncate">
                            {annotation.metadata?.title || (
                              <span className="text-gray-500 italic">
                                Untitled
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Preview text for highlights */}
                        {annotation.data.type === "highlight" && (
                          <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">
                            {annotation.data.ranges[0]?.text}
                          </div>
                        )}

                        {/* Notes preview */}
                        {annotation.metadata?.notes && (
                          <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">
                            {annotation.metadata.notes}
                          </div>
                        )}

                        {/* Tags */}
                        {annotation.metadata?.tags &&
                          annotation.metadata.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {annotation.metadata.tags
                                .slice(0, 2)
                                .map((tag) => (
                                  <span
                                    key={tag}
                                    className="px-1 py-0.5 bg-purple-600/20 border border-purple-600/30 rounded text-[9px] text-purple-300"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              {annotation.metadata.tags.length > 2 && (
                                <span className="text-[9px] text-gray-500">
                                  +{annotation.metadata.tags.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Context Menu trigger (three dots) - visible on hover only */}
                    <div
                      className="absolute right-2 top-2 z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <AnnotationContextMenu
                        annotation={annotation}
                        triggerClassName="opacity-0 group-hover:opacity-100 transition-opacity"
                        onUpdate={() => {
                          onAnnotationUpdated?.();
                        }}
                        onDelete={() => {
                          if (isSelected) {
                            setSelectedAnnotationId(null);
                          }
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
