/**
 * Annotation Overlay - Renders annotations on top of PDF pages
 * Displays saved annotations and in-progress selections
 */

"use client";

import { Fragment, useEffect, useState } from "react";
import type { Annotation, NormalizedRect } from "@/src/schema/annotation";
import { useAnnotationUI } from "@/src/stores/annotation-ui";
import { useReaderUI } from "@/src/stores/reader-ui";
import { AnnotationContextMenu } from "./AnnotationContextMenu";

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
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(
    null
  );
  const [anchoredMenu, setAnchoredMenu] = useState<{
    annotation: Annotation;
    x: number;
    y: number;
  } | null>(null);

  // Expose menu state for parent components (e.g., PDFViewer click handling)
  useEffect(() => {
    // Store reference in a way parent can check
    (AnnotationOverlay as any)._hasOpenMenu = anchoredMenu !== null;
    return () => {
      (AnnotationOverlay as any)._hasOpenMenu = false;
    };
  }, [anchoredMenu]);

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

  /**
   * Get top-left position for annotation metadata overlay
   * Uses the first rectangle of the annotation
   */
  const getMetadataPosition = (annotation: Annotation) => {
    if (annotation.data.type === "rectangle") {
      const firstRect = annotation.data.rects[0];
      if (!firstRect) return null;
      return denormalize(firstRect);
    }
    if (annotation.data.type === "highlight") {
      const firstRange = annotation.data.ranges[0];
      const firstRect = firstRange?.rects[0];
      if (!firstRect) return null;
      return denormalize(firstRect);
    }
    return null;
  };

  /**
   * Reusable component for annotation metadata overlays
   * Positioned at top-left of annotation, shown when selected
   */
  const AnnotationMetadata = ({ annotation }: { annotation: Annotation }) => {
    const position = getMetadataPosition(annotation);
    if (!position) return null;

    const title = annotation.metadata?.title;
    if (!title) return null;

    const color = annotation.metadata?.color || "#fbbf24";

    // Position label above and to the left of the annotation
    const labelX = position.x;
    const labelY = position.y - 8; // 8px above the annotation

    // Measure approximate text width (rough estimate: 6px per character)
    const textWidth = title.length * 6.5;
    const padding = 4;
    const rectHeight = 16;

    return (
      <g className="pointer-events-none">
        {/* Semi-transparent background for contrast */}
        <rect
          x={labelX - padding}
          y={labelY - rectHeight + 2}
          width={textWidth + padding * 2}
          height={rectHeight}
          fill="rgba(0, 0, 0, 0.6)"
          rx={2}
        />
        {/* Text in annotation color (visible against dark bg) */}
        <text
          x={labelX}
          y={labelY - 3}
          className="text-xs font-semibold select-none"
          fill={color}
          style={{
            paintOrder: "stroke fill",
            stroke: "rgba(0, 0, 0, 0.5)",
            strokeWidth: "0.5px",
          }}
        >
          {title}
        </text>
      </g>
    );
  };

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      style={{
        width: pageWidth,
        height: pageHeight,
        zIndex: 40,
      }}
    >
      {/* Anchored context menu */}
      {anchoredMenu && (
        <AnnotationContextMenu
          annotation={anchoredMenu.annotation}
          mode="anchored"
          open={true}
          anchor={{ x: anchoredMenu.x, y: anchoredMenu.y }}
          onRequestClose={() => setAnchoredMenu(null)}
          onUpdate={() => {
            // Close after update to provide immediate feedback
            setAnchoredMenu(null);
          }}
          onDelete={() => {
            setAnchoredMenu(null);
          }}
        />
      )}
      {/* Render saved annotations */}
      {annotations.map((annotation) => {
        const isSelected = annotation.id === selectedAnnotationId;
        const color = annotation.metadata?.color || "#fbbf24";

        // Render metadata overlay for selected or hovered annotation
        const showMetadata =
          isSelected || hoveredAnnotationId === annotation.id;
        const metadataOverlay = showMetadata ? (
          <AnnotationMetadata
            key={`metadata-${annotation.id}`}
            annotation={annotation}
          />
        ) : null;

        if (annotation.data.type === "rectangle") {
          return (
            <Fragment key={annotation.id}>
              {metadataOverlay}
              <g className="pointer-events-auto cursor-pointer">
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
                      className="transition-all hover:fill-opacity-50"
                      onMouseEnter={() => setHoveredAnnotationId(annotation.id)}
                      onMouseLeave={() => setHoveredAnnotationId(null)}
                      onClick={() => onAnnotationClick?.(annotation)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedAnnotationId(annotation.id);
                        setAnchoredMenu({
                          annotation,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
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
            </Fragment>
          );
        }

        if (annotation.data.type === "highlight") {
          return (
            <Fragment key={annotation.id}>
              {metadataOverlay}
              <g className="pointer-events-auto cursor-pointer">
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
                        onMouseEnter={() =>
                          setHoveredAnnotationId(annotation.id)
                        }
                        onMouseLeave={() => setHoveredAnnotationId(null)}
                        onClick={() => onAnnotationClick?.(annotation)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedAnnotationId(annotation.id);
                          setAnchoredMenu({
                            annotation,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
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
            </Fragment>
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
