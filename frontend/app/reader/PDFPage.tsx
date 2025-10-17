/**
 * PDFPage - Renders a single PDF page to canvas
 * Lightweight, reusable component for both full viewer and thumbnails
 */

"use client";

import { useEffect, useRef, useRef as useRef2 } from "react";
import { usePDFPage } from "@/src/hooks/usePDFPage";
import { PDFDocumentProxy } from "@/src/utils/pdf";

export interface PDFPageProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale?: number;
  className?: string;
  docId?: string;
  onLoad?: (width: number, height: number) => void;
}

/**
 * Renders a single PDF page to a canvas element
 * Uses caching to avoid re-rendering when scale/page hasn't changed
 */
export function PDFPage({
  pdf,
  pageNumber,
  scale = 1.5,
  className = "",
  docId,
  onLoad,
}: PDFPageProps) {
  const { canvas, isLoading, error, pageInfo } = usePDFPage(
    pdf,
    pageNumber,
    scale,
    docId
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSizeRef = useRef2<{ w: number; h: number } | null>(null);

  // Insert canvas into DOM when ready
  useEffect(() => {
    if (!containerRef.current || !canvas) return;

    // Clear previous content
    containerRef.current.innerHTML = "";

    // Append canvas
    containerRef.current.appendChild(canvas);

    // Call onLoad callback only if size changed (prevents loops)
    if (onLoad && pageInfo) {
      const w = pageInfo.width || 0;
      const h = pageInfo.height || 0;
      const prev = lastSizeRef.current;
      if (!prev || Math.abs(prev.w - w) > 0.5 || Math.abs(prev.h - h) > 0.5) {
        lastSizeRef.current = { w, h };
        onLoad(w, h);
      }
    }
  }, [canvas, pageInfo, onLoad]);

  return (
    <div
      className={`pdf-page relative ${className}`}
      data-page-number={pageNumber}
      style={{
        width: pageInfo?.width || "auto",
        height: pageInfo?.height || "auto",
      }}
    >
      <div ref={containerRef} className="pdf-page-canvas" />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
          <div className="text-sm text-gray-300">
            Loading page {pageNumber}...
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50">
          <div className="text-sm text-red-600">
            Failed to load page {pageNumber}
          </div>
        </div>
      )}
    </div>
  );
}
