/**
 * NoteConnectors - SVG lines connecting annotations to their notes in sidebar
 * Dynamically positions lines based on annotation coordinates and sidebar position
 *
 * Platform-agnostic component
 */

"use client";

import { useMemo } from "react";
import type { Annotation } from "@deeprecall/core";

interface NoteConnectorsProps {
  /** Annotations with notes on current page */
  annotationsWithNotes: Array<{
    annotation: Annotation;
    noteCount: number;
  }>;
  /** Current page number */
  currentPage: number;
  /** Scale factor for PDF rendering */
  scale: number;
  /** Selected annotation ID for highlighting */
  selectedAnnotationId: string | null;
  /** Container ref for positioning */
  containerRef: React.RefObject<HTMLDivElement>;
}

interface ConnectorLine {
  annotationId: string;
  x1: number; // Annotation right edge
  y1: number; // Annotation center Y
  x2: number; // Sidebar left edge
  y2: number; // Note card center Y
  color: string;
  isSelected: boolean;
}

export function NoteConnectors({
  annotationsWithNotes,
  currentPage,
  scale,
  selectedAnnotationId,
  containerRef,
}: NoteConnectorsProps) {
  // Calculate connector lines
  const connectors = useMemo<ConnectorLine[]>(() => {
    if (!containerRef.current || annotationsWithNotes.length === 0) {
      return [];
    }

    const container = containerRef.current;
    const lines: ConnectorLine[] = [];

    annotationsWithNotes.forEach(({ annotation }, index) => {
      // Get annotation overlay element
      const annotationElement = container.querySelector(
        `[data-annotation-id="${annotation.id}"]`
      ) as HTMLElement;

      if (!annotationElement) return;

      // Get annotation bounding box
      const annotationRect = annotationElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Calculate annotation center point (relative to container)
      const annotationY =
        annotationRect.top + annotationRect.height / 2 - containerRect.top;
      const annotationX = annotationRect.right - containerRect.left;

      // Estimate sidebar note card position
      // Sidebar is 320px wide (80 * 4 = w-80), positioned on right
      const sidebarLeft = containerRect.width - 320;
      const noteCardHeight = 120; // Estimated height per card
      const noteCardY = 120 + index * (noteCardHeight + 16); // Header + cards with gap

      // Line coordinates
      const x1 = annotationX;
      const y1 = annotationY;
      const x2 = sidebarLeft;
      const y2 = noteCardY + noteCardHeight / 2;

      lines.push({
        annotationId: annotation.id,
        x1,
        y1,
        x2,
        y2,
        color: annotation.metadata?.color || "#fbbf24",
        isSelected: annotation.id === selectedAnnotationId,
      });
    });

    return lines;
  }, [annotationsWithNotes, selectedAnnotationId, containerRef, scale]);

  if (connectors.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width: "100%", height: "100%" }}
    >
      <defs>
        {/* Arrow marker for line end */}
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 10 3, 0 6" fill="currentColor" opacity="0.6" />
        </marker>

        {/* Glow filter for selected line */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {connectors.map((line) => (
        <g key={line.annotationId} opacity={line.isSelected ? 1 : 0.3}>
          {/* Curved path with cubic bezier */}
          <path
            d={`M ${line.x1} ${line.y1} C ${line.x1 + 50} ${line.y1}, ${
              line.x2 - 50
            } ${line.y2}, ${line.x2} ${line.y2}`}
            stroke={line.color}
            strokeWidth={line.isSelected ? 3 : 2}
            fill="none"
            strokeDasharray={line.isSelected ? "0" : "5,5"}
            filter={line.isSelected ? "url(#glow)" : undefined}
            className="transition-all duration-300"
          />

          {/* Dot at annotation end */}
          <circle
            cx={line.x1}
            cy={line.y1}
            r={line.isSelected ? 5 : 3}
            fill={line.color}
            className="transition-all duration-300"
          />

          {/* Dot at sidebar end */}
          <circle
            cx={line.x2}
            cy={line.y2}
            r={line.isSelected ? 5 : 3}
            fill={line.color}
            className="transition-all duration-300"
          />
        </g>
      ))}
    </svg>
  );
}
