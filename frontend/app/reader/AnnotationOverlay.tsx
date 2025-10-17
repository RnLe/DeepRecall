/**
 * Annotation Overlay - Renders annotations on top of PDF pages
 * Displays saved annotations and in-progress selections
 */

"use client";

import { Fragment, useEffect, useState } from "react";
import type { Annotation, NormalizedRect } from "@/src/schema/annotation";
import type { AnnotationTool } from "@/src/stores/annotation-ui";
import { useAnnotationUI } from "@/src/stores/annotation-ui";
import { useReaderUI } from "@/src/stores/reader-ui";
import { AnnotationContextMenu } from "./AnnotationContextMenu";
import {
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

const ANNOTATION_KINDS: Record<string, any> = {
  Equation: FunctionSquare,
  Table: Table2,
  Figure: Image,
  Abstract: BookOpen,
  Definition: Lightbulb,
  Theorem: CheckSquare,
  Proof: Shield,
  Example: Beaker,
  Note: StickyNote,
  Question: HelpCircle,
};

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
  /** Current annotation tool */
  tool: AnnotationTool;
  /** Callback when annotation is clicked */
  onAnnotationClick?: (annotation: Annotation) => void;
  /** Callback to save in-progress annotation */
  onSave?: () => void;
  /** Callback to cancel in-progress annotation */
  onCancel?: () => void;
}

export function AnnotationOverlay({
  sha256,
  page,
  pageWidth,
  pageHeight,
  annotations,
  tool,
  onAnnotationClick,
  onSave,
  onCancel,
}: AnnotationOverlayProps) {
  const {
    selection,
    selectedAnnotationId,
    setSelectedAnnotationId,
    isDrawing,
  } = useAnnotationUI();
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
                {/* Kind icon badge at top-right corner */}
                {annotation.metadata?.kind &&
                  annotation.data.rects[0] &&
                  (() => {
                    const firstRect = denormalize(annotation.data.rects[0]);
                    const KindIcon = ANNOTATION_KINDS[annotation.metadata.kind];
                    if (!KindIcon) return null;

                    const iconSize = 28;
                    const iconX = firstRect.x + firstRect.width - iconSize / 2;
                    const iconY = firstRect.y - iconSize / 2;

                    return (
                      <g
                        key="kind-icon"
                        transform={`translate(${iconX}, ${iconY})`}
                      >
                        <circle
                          cx={iconSize / 2}
                          cy={iconSize / 2}
                          r={iconSize / 2}
                          fill="#ffffff"
                          stroke={color}
                          strokeWidth={2.5}
                        />
                        <foreignObject
                          x={4}
                          y={4}
                          width={iconSize - 8}
                          height={iconSize - 8}
                          style={{ pointerEvents: "none" }}
                        >
                          <div className="flex items-center justify-center w-full h-full">
                            <KindIcon
                              style={{
                                width: 16,
                                height: 16,
                                color: "#000000",
                                strokeWidth: 2,
                              }}
                            />
                          </div>
                        </foreignObject>
                      </g>
                    );
                  })()}
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
                        fillOpacity={isSelected ? 0.25 : 0.2}
                        stroke="none"
                        className="transition-all hover:fill-opacity-30"
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
                  fillOpacity={0.2}
                  stroke="none"
                  className="pointer-events-none"
                />
              );
            })
          )}
        </>
      )}

      {/* Anchored Save/Cancel buttons for completed selections */}
      {selection.page === page &&
        !isDrawing &&
        (tool === "rectangle" ||
          tool === "highlight" ||
          tool === "kind-rectangle") &&
        (selection.rectangles.length > 0 || selection.textRanges.length > 0) &&
        onSave &&
        onCancel && (
          <>
            {(() => {
              // Calculate position for buttons (top-left of first selection)
              let buttonX = 0;
              let buttonY = 0;

              if (selection.rectangles.length > 0) {
                const rect = denormalize(selection.rectangles[0]);
                buttonX = rect.x;
                buttonY = rect.y;
              } else if (
                selection.textRanges.length > 0 &&
                selection.textRanges[0].rects.length > 0
              ) {
                const rect = denormalize(selection.textRanges[0].rects[0]);
                buttonX = rect.x;
                buttonY = rect.y;
              }

              return (
                <g transform={`translate(${buttonX}, ${buttonY - 36})`}>
                  {/* Save button */}
                  <g
                    className="cursor-pointer transition-all hover:brightness-110"
                    style={{ pointerEvents: "all" }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSave?.();
                    }}
                  >
                    <rect
                      x={0}
                      y={0}
                      width={70}
                      height={28}
                      rx={4}
                      fill="#9333ea"
                      style={{ pointerEvents: "all" }}
                    />
                    {/* Save icon (check mark) */}
                    <path
                      d="M16 7l-6 6-3-3"
                      stroke="white"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    <text
                      x={28}
                      y={18}
                      fill="white"
                      fontSize={12}
                      fontWeight="500"
                    >
                      Save
                    </text>
                  </g>

                  {/* Cancel button */}
                  <g
                    className="cursor-pointer transition-all hover:brightness-110"
                    style={{ pointerEvents: "all" }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onCancel?.();
                    }}
                    transform="translate(78, 0)"
                  >
                    <rect
                      x={0}
                      y={0}
                      width={70}
                      height={28}
                      rx={4}
                      fill="#374151"
                      style={{ pointerEvents: "all" }}
                    />
                    {/* Cancel icon (X) */}
                    <path
                      d="M15 9L21 15M21 9L15 15"
                      stroke="#d1d5db"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <text
                      x={28}
                      y={18}
                      fill="#d1d5db"
                      fontSize={12}
                      fontWeight="500"
                    >
                      Cancel
                    </text>
                  </g>
                </g>
              );
            })()}
          </>
        )}
    </svg>
  );
}
