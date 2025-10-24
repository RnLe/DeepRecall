/**
 * PDFScrollbar - Custom scrollbar with viewport indicator and annotation markers
 * Shows current viewport position and all annotations as colored stripes
 *
 * Platform-agnostic component
 */

"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import type { Annotation } from "@deeprecall/core";

interface PDFScrollbarProps {
  /** Total height of all PDF content in pixels (scaled) */
  totalHeight: number;
  /** Array of page heights (scaled) */
  pageHeights: number[];
  /** Current scroll position */
  scrollTop: number;
  /** Height of visible viewport */
  containerHeight: number;
  /** All annotations across all pages */
  annotations: Annotation[];
  /** Current zoom scale */
  scale: number;
  /** Callback when scrollbar is clicked */
  onScrollTo: (scrollTop: number) => void;
  /** Callback when annotation is selected */
  onAnnotationSelect: (annotation: Annotation, yOffset: number) => void;
}

interface AnnotationStripe {
  /** Annotation for callbacks */
  annotation: Annotation;
  /** Annotation ID for key */
  id: string;
  /** Top position as percentage (0-100) */
  top: number;
  /** Height as percentage (0-100) */
  height: number;
  /** Top position in pixels (absolute) */
  topPixels: number;
  /** Annotation color */
  color: string;
}

/**
 * Calculate the vertical position and height of an annotation in the document
 * Returns position as percentage of total document height
 */
function calculateAnnotationPosition(
  annotation: Annotation,
  pageHeights: number[],
  scale: number
): { top: number; height: number } | null {
  const pageIndex = annotation.page - 1;
  if (pageIndex < 0 || pageIndex >= pageHeights.length) return null;

  const pageGap = 16; // Gap between pages
  const scaledPageHeight = pageHeights[pageIndex];

  // Calculate cumulative height before this page
  let cumulativeHeight = 0;
  for (let i = 0; i < pageIndex; i++) {
    cumulativeHeight += pageHeights[i] + pageGap;
  }

  // Get annotation bounds on the page
  let minY = 1;
  let maxY = 0;

  if (annotation.data.type === "rectangle") {
    for (const rect of annotation.data.rects) {
      minY = Math.min(minY, rect.y);
      maxY = Math.max(maxY, rect.y + rect.height);
    }
  } else if (annotation.data.type === "highlight") {
    for (const range of annotation.data.ranges) {
      for (const rect of range.rects) {
        minY = Math.min(minY, rect.y);
        maxY = Math.max(maxY, rect.y + rect.height);
      }
    }
  }

  // Convert normalized coordinates to pixel positions
  const topPixels = cumulativeHeight + minY * scaledPageHeight;
  const bottomPixels = cumulativeHeight + maxY * scaledPageHeight;
  const heightPixels = bottomPixels - topPixels;

  return {
    top: topPixels,
    height: heightPixels,
  };
}

export function PDFScrollbar({
  totalHeight,
  pageHeights,
  scrollTop,
  containerHeight,
  annotations,
  scale,
  onScrollTo,
  onAnnotationSelect,
}: PDFScrollbarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragScrollTop, setDragScrollTop] = useState<number | null>(null);
  const dragScrollTopRef = useRef<number | null>(null); // Use ref during drag to prevent re-renders
  const [justFinishedDragging, setJustFinishedDragging] = useState(false);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(
    null
  );
  const [isHoveringCursor, setIsHoveringCursor] = useState(false);

  // Store callbacks in refs to prevent effect re-runs
  const onScrollToRef = useRef(onScrollTo);
  onScrollToRef.current = onScrollTo;

  const onAnnotationSelectRef = useRef(onAnnotationSelect);
  onAnnotationSelectRef.current = onAnnotationSelect;

  // Stable hover handlers
  const handleCursorMouseEnter = useCallback(
    () => setIsHoveringCursor(true),
    []
  );
  const handleCursorMouseLeave = useCallback(
    () => setIsHoveringCursor(false),
    []
  );

  // Calculate annotation stripes
  const annotationStripes = useMemo<AnnotationStripe[]>(() => {
    if (totalHeight === 0) return [];

    const stripes: AnnotationStripe[] = [];

    for (const annotation of annotations) {
      const position = calculateAnnotationPosition(
        annotation,
        pageHeights,
        scale
      );
      if (!position) continue;

      const topPercent = (position.top / totalHeight) * 100;
      const heightPercent = (position.height / totalHeight) * 100;

      stripes.push({
        annotation,
        id: annotation.id,
        top: topPercent,
        height: Math.max(heightPercent, 0.2), // Minimum visible height
        topPixels: position.top,
        color: annotation.metadata?.color || "#fbbf24",
      });
    }

    return stripes;
  }, [annotations, pageHeights, scale, totalHeight]);

  // Calculate viewport cursor position and size
  // During drag, use dragScrollTop for immediate feedback; otherwise use scrollTop
  const viewportCursor = useMemo(() => {
    if (totalHeight === 0 || containerHeight === 0) {
      return { top: 0, height: 100 };
    }

    // Use drag position when dragging, otherwise use actual scroll position
    const effectiveScrollTop =
      isDragging && dragScrollTop !== null ? dragScrollTop : scrollTop;
    const topPercent = (effectiveScrollTop / totalHeight) * 100;
    const heightPercent = (containerHeight / totalHeight) * 100;

    return {
      top: Math.max(0, Math.min(100 - heightPercent, topPercent)),
      height: Math.min(100, heightPercent),
    };
  }, [scrollTop, dragScrollTop, isDragging, containerHeight, totalHeight]);

  // Handle click on annotation stripe
  const handleAnnotationClick = useCallback(
    (e: React.MouseEvent, stripe: AnnotationStripe) => {
      e.stopPropagation();

      // Don't trigger if we just finished dragging
      if (justFinishedDragging) {
        return;
      }

      // Calculate normalized Y position within the annotation (for precise positioning)
      const normalizedY =
        stripe.annotation.data.type === "rectangle"
          ? stripe.annotation.data.rects[0]?.y || 0
          : stripe.annotation.data.ranges[0]?.rects[0]?.y || 0;

      onAnnotationSelectRef.current(stripe.annotation, normalizedY);
    },
    [justFinishedDragging]
  );

  // Handle click on scrollbar background (jump to position)
  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const clickPercent = clickY / rect.height;
      const targetScroll = clickPercent * totalHeight;

      // Center viewport at clicked position
      const centeredScroll = targetScroll - containerHeight / 2;
      const clampedScroll = Math.max(
        0,
        Math.min(totalHeight - containerHeight, centeredScroll)
      );

      onScrollToRef.current(clampedScroll);
    },
    [totalHeight, containerHeight]
  );

  // Handle cursor drag start
  const handleCursorMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  // Handle dragging
  useEffect(() => {
    if (!isDragging) {
      // Clear drag position when not dragging
      setDragScrollTop(null);
      return;
    }

    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      // Find the scrollbar element
      const scrollbarElement = document.querySelector(".pdf-scrollbar");
      if (!scrollbarElement) return;

      const rect = scrollbarElement.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;
      const percent = Math.max(0, Math.min(1, mouseY / rect.height));
      const targetScroll = percent * totalHeight;

      // Adjust for cursor height to make dragging feel natural
      const adjustedScroll = targetScroll - containerHeight / 2;
      const clampedScroll = Math.max(
        0,
        Math.min(totalHeight - containerHeight, adjustedScroll)
      );

      // Throttle updates to the next animation frame to avoid deep update loops
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        // Update ref for visual feedback (no re-render during drag)
        dragScrollTopRef.current = clampedScroll;
        setDragScrollTop(clampedScroll); // Update state once for render
        // Also update actual scroll position
        onScrollToRef.current(clampedScroll);
        rafId = null;
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragScrollTopRef.current = null;
      setDragScrollTop(null);

      // Set flag to prevent annotation click on release
      setJustFinishedDragging(true);

      // Clear flag after a short delay
      setTimeout(() => {
        setJustFinishedDragging(false);
      }, 100);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isDragging, totalHeight, containerHeight]);

  if (totalHeight === 0) return null;

  return (
    <div
      className="pdf-scrollbar absolute right-0 inset-y-0 select-none"
      style={{
        width: "40px",
        zIndex: 20,
        cursor: "default",
      }}
      onClick={handleBackgroundClick}
    >
      {/* Basis - semi-transparent background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(200, 200, 200, 0.15)",
        }}
      />

      {/* Annotation stripes - drawn over all layers, solid colors */}
      {annotationStripes.map((stripe) => {
        const isHovered = hoveredAnnotationId === stripe.id;
        return (
          <div
            key={stripe.id}
            className="absolute left-0 right-0 transition-all"
            style={{
              cursor: "default",
              top: `${stripe.top}%`,
              height: `${stripe.height}%`,
              backgroundColor: stripe.color,
              opacity: isHovered ? 0.9 : 0.7,
              transform: isHovered ? "scaleX(1.1)" : "scaleX(1)",
              transformOrigin: "left",
              zIndex: 2,
            }}
            onClick={(e) => handleAnnotationClick(e, stripe)}
            onMouseEnter={() => setHoveredAnnotationId(stripe.id)}
            onMouseLeave={() => setHoveredAnnotationId(null)}
          />
        );
      })}

      {/* Viewport cursor - shows current visible area */}
      <div
        className="absolute left-0 right-0"
        style={{
          top: `${viewportCursor.top}%`,
          height: `${viewportCursor.height}%`,
          backgroundColor:
            isHoveringCursor && !isDragging
              ? "rgba(220, 220, 220, 0.6)"
              : isDragging
                ? "rgba(240, 240, 240, 0.7)"
                : "rgba(200, 200, 200, 0.4)",
          zIndex: 1,
          cursor: "default",
        }}
        onMouseDown={handleCursorMouseDown}
        onMouseEnter={handleCursorMouseEnter}
        onMouseLeave={handleCursorMouseLeave}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
