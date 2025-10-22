/**
 * Annotation Mouse Handlers - Handle mouse interactions for annotation tools
 * Converts screen coordinates to normalized coordinates for storage
 */

"use client";

import { useRef, useCallback } from "react";
import type { NormalizedRect } from "@deeprecall/core";
import { useAnnotationUI } from "@deeprecall/data/stores";

interface AnnotationHandlersProps {
  /** Current page number */
  page: number;
  /** Page width in pixels */
  pageWidth: number;
  /** Page height in pixels */
  pageHeight: number;
  /** Container element ref */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Children (PDF canvas) */
  children: React.ReactNode;
}

export function AnnotationHandlers({
  page,
  pageWidth,
  pageHeight,
  containerRef,
  children,
}: AnnotationHandlersProps) {
  const { tool, selection, setSelection, setIsDrawing } = useAnnotationUI();
  const pageRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<{
    startX: number;
    startY: number;
    isDrawing: boolean;
  } | null>(null);

  // Convert screen coordinates to normalized coordinates (0-1 range)
  const normalizePoint = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      if (!pageRef.current) return { x: 0, y: 0 };

      const rect = pageRef.current.getBoundingClientRect();
      const x = (clientX - rect.left) / pageWidth;
      const y = (clientY - rect.top) / pageHeight;

      return {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      };
    },
    [pageWidth, pageHeight]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (tool === "pan") return;

      // Only handle rectangle tools with mouse (highlight uses text selection)
      if (tool !== "rectangle" && tool !== "kind-rectangle") return;

      e.preventDefault();
      e.stopPropagation();

      const { x, y } = normalizePoint(e.clientX, e.clientY);
      drawingRef.current = { startX: x, startY: y, isDrawing: true };
      setIsDrawing(true);

      // Initialize selection if needed
      if (selection.page !== page) {
        setSelection({
          rectangles: [],
          textRanges: [],
          page,
        });
      }
    },
    [tool, page, selection.page, normalizePoint, setSelection]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (
        !drawingRef.current?.isDrawing ||
        (tool !== "rectangle" && tool !== "kind-rectangle")
      )
        return;

      e.preventDefault();
      e.stopPropagation();

      const { x: endX, y: endY } = normalizePoint(e.clientX, e.clientY);
      const { startX, startY } = drawingRef.current;

      // Create normalized rect
      const rect: NormalizedRect = {
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
      };

      // Update current rectangle (replace last one during drag)
      setSelection({
        rectangles:
          selection.rectangles.length > 0
            ? [...selection.rectangles.slice(0, -1), rect]
            : [rect],
        page,
      });
    },
    [tool, page, selection.rectangles, normalizePoint, setSelection]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (
        !drawingRef.current?.isDrawing ||
        (tool !== "rectangle" && tool !== "kind-rectangle")
      )
        return;

      e.preventDefault();
      e.stopPropagation();

      const { x: endX, y: endY } = normalizePoint(e.clientX, e.clientY);
      const { startX, startY } = drawingRef.current;

      // Create final normalized rect
      const rect: NormalizedRect = {
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
      };

      // Only add if rect has some size (not just a click)
      if (rect.width > 0.01 && rect.height > 0.01) {
        // For multi-rect support: Add to existing rectangles if shift key held
        const newRects = e.shiftKey
          ? [...selection.rectangles.slice(0, -1), rect] // Replace last temp rect
          : selection.rectangles.length > 0
            ? [...selection.rectangles.slice(0, -1), rect] // Replace last temp rect
            : [rect];

        setSelection({
          rectangles: newRects,
          page,
        });
      }

      drawingRef.current = null;
      setIsDrawing(false);
    },
    [
      tool,
      page,
      selection.rectangles,
      normalizePoint,
      setSelection,
      setIsDrawing,
    ]
  );

  const handleTextSelection = useCallback(() => {
    if (tool !== "highlight") return;

    const browserSelection = window.getSelection();
    if (!browserSelection || browserSelection.rangeCount === 0) return;

    const text = browserSelection.toString().trim();
    if (!text) return;

    // Get all rects for the selection
    const range = browserSelection.getRangeAt(0);
    const clientRects = range.getClientRects();

    if (clientRects.length === 0) return;

    // Convert client rects to normalized rects
    const normalizedRects: NormalizedRect[] = [];
    for (let i = 0; i < clientRects.length; i++) {
      const clientRect = clientRects[i];
      const topLeft = normalizePoint(clientRect.left, clientRect.top);
      const bottomRight = normalizePoint(clientRect.right, clientRect.bottom);

      normalizedRects.push({
        x: topLeft.x,
        y: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
      });
    }

    // Add to selection
    setSelection({
      textRanges: [...selection.textRanges, { text, rects: normalizedRects }],
      page,
    });

    // Clear browser selection
    browserSelection.removeAllRanges();
  }, [tool, page, selection.textRanges, normalizePoint, setSelection]);

  // Only attach handlers when in rectangle mode
  // For pan and highlight, let events pass through to text layer
  if (tool === "pan" || tool === "highlight") {
    return (
      <div
        ref={pageRef}
        onMouseUpCapture={
          tool === "highlight" ? handleTextSelection : undefined
        }
        className="relative"
        style={{ userSelect: "text" }}
      >
        {children}
      </div>
    );
  }

  // Rectangle or kind-rectangle mode: capture all mouse events
  // Text layer handles its own cursor and pointer events based on tool
  return (
    <div
      ref={pageRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="relative"
      style={{
        cursor: "crosshair",
        userSelect: "none",
      }}
    >
      {children}
    </div>
  );
}
