/**
 * Annotation Overlay - Renders annotations on top of PDF pages
 * Displays saved annotations and in-progress selections
 */

"use client";

import { useEffect, useState } from "react";
import type { Annotation, NormalizedRect } from "@/src/schema/annotation";
import { useAnnotationUI } from "@/src/stores/annotation-ui";
import { useReaderUI } from "@/src/stores/reader-ui";

interface AnnotationOverlayProps {
  /** PDF document SHA-256 hash */
  sha256: string;
  /** Current page number (1-indexed) */
  page: number;
  /** Page width in pixels (for coordinate conversion) */
  pageWidth: number;
  /** Page height in pixels (for coordinate conversion) */
  pageHeight: number;
  /** Saved annotations for this page */
  annotations: Annotation[];
  /** Callback when annotation is clicked */
  onAnnotationClick?: (annotation: Annotation) => void;
}

export function AnnotationOverlay({
  sha256,
  page,
  pageWidth,
  pageHeight,
  annotations,
  onAnnotationClick,
}: AnnotationOverlayProps) {
  const { selection, selectedAnnotationId, setSelectedAnnotationId } =
    useAnnotationUI();
  const { rightSidebarOpen, toggleRightSidebar } = useReaderUI();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Convert normalized rect to pixel coordinates
  const denormalize = (rect: NormalizedRect) => ({
    x: rect.x * pageWidth,
    y: rect.y * pageHeight,
    width: rect.width * pageWidth,
    height: rect.height * pageHeight,
  });

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      style={{
        width: pageWidth,
        height: pageHeight,
        zIndex: 10,
      }}
    >
      {/* Render saved annotations */}
      {annotations.map((annotation) => {
        const isSelected = annotation.id === selectedAnnotationId;
        const color = annotation.metadata?.color || "#fbbf24";

        if (annotation.data.type === "rectangle") {
          return (
            <g
              key={annotation.id}
              className="pointer-events-auto cursor-pointer"
            >
              {annotation.data.rects.map((rect, idx) => {
                const { x, y, width, height } = denormalize(rect);
                return (
                  <rect
                    key={idx}
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill={color}
                    fillOpacity={0.1}
                    stroke={color}
                    strokeWidth={isSelected ? 3 : 2}
                    strokeOpacity={0.8}
                    className="transition-all hover:fill-opacity-20"
                    onClick={() => onAnnotationClick?.(annotation)}
                    onDoubleClick={() => {
                      setSelectedAnnotationId(annotation.id);
                      if (!rightSidebarOpen) {
                        toggleRightSidebar();
                      }
                    }}
                  />
                );
              })}
            </g>
          );
        }

        if (annotation.data.type === "highlight") {
          return (
            <g
              key={annotation.id}
              className="pointer-events-auto cursor-pointer"
            >
              {annotation.data.ranges.flatMap((range, rangeIdx) =>
                range.rects.map((rect, rectIdx) => {
                  const { x, y, width, height } = denormalize(rect);
                  return (
                    <rect
                      key={`${rangeIdx}-${rectIdx}`}
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={color}
                      fillOpacity={isSelected ? 0.4 : 0.3}
                      stroke="none"
                      className="transition-all hover:fill-opacity-50"
                      onClick={() => onAnnotationClick?.(annotation)}
                      onDoubleClick={() => {
                        setSelectedAnnotationId(annotation.id);
                        if (!rightSidebarOpen) {
                          toggleRightSidebar();
                        }
                      }}
                    />
                  );
                })
              )}
            </g>
          );
        }

        return null;
      })}

      {/* Render in-progress selection */}
      {selection.page === page && (
        <>
          {/* Rectangle selection */}
          {selection.rectangles.map((rect, idx) => {
            const { x, y, width, height } = denormalize(rect);
            return (
              <rect
                key={`selection-rect-${idx}`}
                x={x}
                y={y}
                width={width}
                height={height}
                fill={selection.color}
                fillOpacity={0.15}
                stroke={selection.color}
                strokeWidth={2}
                strokeDasharray="4 4"
                strokeOpacity={0.9}
                className="pointer-events-none animate-pulse"
              />
            );
          })}

          {/* Highlight selection */}
          {selection.textRanges.flatMap((range, rangeIdx) =>
            range.rects.map((rect, rectIdx) => {
              const { x, y, width, height } = denormalize(rect);
              return (
                <rect
                  key={`selection-highlight-${rangeIdx}-${rectIdx}`}
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill={selection.color}
                  fillOpacity={0.4}
                  stroke="none"
                  className="pointer-events-none"
                />
              );
            })
          )}
        </>
      )}
    </svg>
  );
}
