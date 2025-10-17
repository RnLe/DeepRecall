/**
 * PDFPage - Renders a single PDF page to canvas with text layer
 * Lightweight, reusable component for both full viewer and thumbnails
 */

"use client";

import { useEffect, useRef, useRef as useRef2, useState } from "react";
import { usePDFPage } from "@/src/hooks/usePDFPage";
import { PDFDocumentProxy, PDFPageProxy } from "@/src/utils/pdf";
import { PDFTextLayer } from "./PDFTextLayer";

export interface PDFPageProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale?: number;
  className?: string;
  docId?: string;
  onLoad?: (width: number, height: number) => void;
  /** Enable text layer for selection (default: true) */
  enableTextLayer?: boolean;
}

/**
 * Renders a single PDF page to a canvas element with optional text layer
 * Uses caching to avoid re-rendering when scale/page hasn't changed
 */
export function PDFPage({
  pdf,
  pageNumber,
  scale = 1.5,
  className = "",
  docId,
  onLoad,
  enableTextLayer = true,
}: PDFPageProps) {
  const { canvas, isLoading, error, pageInfo } = usePDFPage(
    pdf,
    pageNumber,
    scale,
    docId
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSizeRef = useRef2<{ w: number; h: number } | null>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [viewport, setViewport] = useState<any>(null);

  // Load page object for text layer
  useEffect(() => {
    if (!pdf || !enableTextLayer) return;

    let cancelled = false;

    pdf.getPage(pageNumber).then((p) => {
      if (cancelled) return;
      setPage(p);
      const vp = p.getViewport({ scale });
      setViewport(vp);
    });

    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber, scale, enableTextLayer]);

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

      {/* Text layer for selection */}
      {enableTextLayer && page && viewport && !isLoading && !error && (
        <PDFTextLayer page={page} scale={scale} viewport={viewport} />
      )}

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
