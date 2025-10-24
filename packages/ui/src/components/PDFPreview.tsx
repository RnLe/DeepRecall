/**
 * PDFPreview - Lightweight PDF viewer component for embedding in sidebars/panels
 * Stripped-down version without annotations, notes, or custom scrollbar
 * Ideal for document previews in dialogs and sidebars
 *
 * Platform-agnostic component using @deeprecall/pdf
 */

"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { usePDF, usePDFViewport } from "@deeprecall/pdf";
import { PDFPage } from "../reader/PDFPage";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsLeftRight,
  ChevronsUpDown,
} from "lucide-react";

export interface PDFPreviewProps {
  source: string | Uint8Array | ArrayBuffer;
  /** SHA-256 hash of PDF (for caching) */
  sha256?: string;
  className?: string;
  /** Show toolbar (default: true) */
  showToolbar?: boolean;
  /** Auto-fit to width on mount (default: false) */
  autoFitToWidth?: boolean;
  /** Auto-fit to height on mount (default: false) */
  autoFitToHeight?: boolean;
}

/**
 * Simplified PDF viewer with virtualized rendering
 * Only renders visible pages + buffer for performance
 * No annotation support - pure viewing experience
 */
export function PDFPreview({
  source,
  sha256,
  className = "",
  showToolbar = true,
  autoFitToWidth = false,
  autoFitToHeight = false,
}: PDFPreviewProps) {
  const {
    pdf,
    numPages,
    isLoading: pdfLoading,
    error: pdfError,
  } = usePDF(source);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track programmatic scroll to prevent feedback loop
  const isProgrammaticScroll = useRef(false);

  // Track page dimensions (unscaled) for viewport calculations
  const [pageHeights, setPageHeights] = useState<number[]>([]);
  const [pageWidths, setPageWidths] = useState<number[]>([]);
  // Page input state for editable current page
  const [pageInput, setPageInput] = useState<string>("1");
  // Track if initial fit-to-width has been applied
  const [hasAppliedInitialFit, setHasAppliedInitialFit] = useState(false);

  // Initialize page heights array when PDF loads
  useEffect(() => {
    if (!pdf || numPages === 0) return;

    // Get first page to estimate heights (assume uniform for now)
    pdf.getPage(1).then((page) => {
      const viewport = page.getViewport({ scale: 1 });
      const estimatedHeight = viewport.height;
      const estimatedWidth = viewport.width;

      // Initialize all pages with estimated height
      setPageHeights(Array(numPages).fill(estimatedHeight));
      setPageWidths(Array(numPages).fill(estimatedWidth));

      page.cleanup();
    });
  }, [pdf, numPages]);

  const viewport = usePDFViewport(numPages, pageHeights, 2);

  // Keep input in sync with current page
  useEffect(() => {
    setPageInput(String(viewport.currentPage));
  }, [viewport.currentPage]);

  // Handle scroll events with RAF for immediate cursor updates
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;

    const handleScroll = () => {
      // Skip if this is a programmatic scroll update
      if (isProgrammaticScroll.current) {
        isProgrammaticScroll.current = false;
        return;
      }

      // Cancel any pending RAF to avoid duplicate updates
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      // Update on next frame for immediate visual feedback
      rafId = requestAnimationFrame(() => {
        viewport.updateScroll(container.scrollTop);
        rafId = null;
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [viewport]);

  // Sync DOM scrollTop when viewport.scrollTop changes (for programmatic jumps)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const diff = Math.abs(container.scrollTop - viewport.scrollTop);
    if (diff > 1) {
      isProgrammaticScroll.current = true;
      container.scrollTop = viewport.scrollTop;
    }
  }, [viewport.scrollTop]);

  // Update container height on resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        viewport.updateContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [viewport]);

  // Handle page load to update actual heights (memoized & guarded)
  const handlePageLoad = useCallback(
    (pageNumber: number, width: number, height: number) => {
      setPageHeights((prev) => {
        const unscaled = height / viewport.scale;
        const current = prev[pageNumber - 1];
        if (current === undefined || Math.abs(current - unscaled) > 0.5) {
          const next = [...prev];
          next[pageNumber - 1] = unscaled;
          return next;
        }
        return prev;
      });
      setPageWidths((prev) => {
        const unscaledW = width / viewport.scale;
        const current = prev[pageNumber - 1];
        if (current === undefined || Math.abs(current - unscaledW) > 0.5) {
          const next = [...prev];
          next[pageNumber - 1] = unscaledW;
          return next;
        }
        return prev;
      });
    },
    [viewport.scale]
  );

  // Fit controls
  const fitToWidth = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const padding = 32;
    const available = container.clientWidth - padding;
    const baseWidth =
      pageWidths[viewport.currentPage - 1] ?? pageWidths[0] ?? 800;
    if (baseWidth > 0) {
      const newScale = available / baseWidth;
      viewport.setScale(newScale);
    }
  }, [pageWidths, viewport]);

  const fitToHeight = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const padding = 32;
    const available = container.clientHeight - padding;
    const baseHeight =
      pageHeights[viewport.currentPage - 1] ?? pageHeights[0] ?? 1000;
    if (baseHeight > 0) {
      const newScale = available / baseHeight;
      viewport.setScale(newScale);
      // Ensure current page stays centered after scale change
      viewport.goToPage(viewport.currentPage);
    }
  }, [pageHeights, viewport]);

  // Auto fit-to-width on mount (only once)
  useEffect(() => {
    if (
      autoFitToWidth &&
      !hasAppliedInitialFit &&
      pageWidths.length > 0 &&
      containerRef.current
    ) {
      // Wait for container to be measured
      const timer = setTimeout(() => {
        fitToWidth();
        setHasAppliedInitialFit(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFitToWidth, hasAppliedInitialFit, pageWidths.length, fitToWidth]);

  // Auto fit-to-height on mount (only once)
  useEffect(() => {
    if (
      autoFitToHeight &&
      !hasAppliedInitialFit &&
      pageHeights.length > 0 &&
      containerRef.current
    ) {
      // Wait for container to be measured
      const timer = setTimeout(() => {
        fitToHeight();
        setHasAppliedInitialFit(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFitToHeight, hasAppliedInitialFit, pageHeights.length, fitToHeight]);

  // Calculate total height for virtual scrolling
  const totalHeight = useMemo(() => {
    const scaledHeights = pageHeights.map((h) => h * viewport.scale);
    return scaledHeights.reduce((sum, h) => sum + h + 16, 0); // 16px gap
  }, [pageHeights, viewport.scale]);

  if (pdfLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-sm text-neutral-400">Loading PDF...</div>
      </div>
    );
  }

  if (pdfError) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-sm text-red-400">
          Failed to load PDF: {pdfError.message}
        </div>
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-sm text-neutral-400">No PDF loaded</div>
      </div>
    );
  }

  return (
    <div className={`pdf-preview flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      {showToolbar && (
        <div className="pdf-toolbar flex items-center gap-2 p-2 bg-neutral-800 border-b border-neutral-700">
          {/* Left: Zoom & Fit */}
          <div className="flex items-center gap-1">
            <button
              onClick={viewport.zoomOut}
              disabled={viewport.scale <= 0.5}
              className="px-1.5 py-1 bg-neutral-700 border border-neutral-600 rounded hover:bg-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-200 text-xs font-medium transition-colors"
              title="Zoom out"
            >
              −
            </button>

            <span className="text-xs w-10 text-center text-neutral-300 font-medium">
              {Math.round(viewport.scale * 100)}%
            </span>

            <button
              onClick={viewport.zoomIn}
              disabled={viewport.scale >= 4}
              className="px-1.5 py-1 bg-neutral-700 border border-neutral-600 rounded hover:bg-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-200 text-xs font-medium transition-colors"
              title="Zoom in"
            >
              +
            </button>

            <div className="h-4 w-px bg-neutral-700 mx-1" />

            <button
              onClick={fitToWidth}
              className="p-1 bg-neutral-700 border border-neutral-600 rounded hover:bg-neutral-600 text-neutral-200 transition-colors"
              title="Fit to width"
            >
              <ChevronsLeftRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={fitToHeight}
              className="p-1 bg-neutral-700 border border-neutral-600 rounded hover:bg-neutral-600 text-neutral-200 transition-colors"
              title="Fit to height"
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Center: Page navigation */}
          <div className="flex-1 flex items-center justify-center gap-1.5">
            <button
              onClick={() => viewport.goToPage(1)}
              disabled={viewport.currentPage === 1}
              className="px-1.5 py-1 bg-neutral-700 border border-neutral-600 rounded hover:bg-neutral-600 disabled:opacity-40 text-neutral-200"
              title="First page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={viewport.prevPage}
              disabled={viewport.currentPage === 1}
              className="px-1.5 py-1 bg-neutral-700 border border-neutral-600 rounded hover:bg-neutral-600 disabled:opacity-40 text-neutral-200"
              title="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1.5 text-neutral-300 text-xs">
              <input
                value={pageInput}
                onChange={(e) =>
                  setPageInput(e.target.value.replace(/[^0-9]/g, ""))
                }
                onBlur={() => {
                  const n = Math.max(
                    1,
                    Math.min(numPages, Number(pageInput) || 1)
                  );
                  viewport.goToPage(n);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const n = Math.max(
                      1,
                      Math.min(numPages, Number(pageInput) || 1)
                    );
                    viewport.goToPage(n);
                  }
                }}
                className="w-12 px-1.5 py-0.5 bg-neutral-900 border border-neutral-700 rounded text-neutral-200 text-center text-xs"
                inputMode="numeric"
              />
              <span className="opacity-70">/ {numPages}</span>
            </div>

            <button
              onClick={viewport.nextPage}
              disabled={viewport.currentPage === numPages}
              className="px-1.5 py-1 bg-neutral-700 border border-neutral-600 rounded hover:bg-neutral-600 disabled:opacity-40 text-neutral-200"
              title="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => viewport.goToPage(numPages)}
              disabled={viewport.currentPage === numPages}
              className="px-1.5 py-1 bg-neutral-700 border border-neutral-600 rounded hover:bg-neutral-600 disabled:opacity-40 text-neutral-200"
              title="Last page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div
        ref={containerRef}
        className="pdf-container flex-1 overflow-auto bg-neutral-900 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-neutral-900 [&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-neutral-500"
        style={{
          scrollbarWidth: "thin", // Firefox
          scrollbarColor: "#525252 #171717", // Firefox: thumb track
        }}
      >
        <div
          className="pdf-pages-container relative mx-auto"
          style={{
            height: `${totalHeight}px`,
            width: "fit-content",
            paddingTop: "16px",
            paddingBottom: "16px",
          }}
        >
          {viewport.visiblePages.map((pageNumber) => {
            const cumulativeHeight = pageHeights
              .slice(0, pageNumber - 1)
              .reduce((sum, h) => sum + h * viewport.scale + 16, 0);

            return (
              <div
                key={pageNumber}
                className="pdf-page-wrapper relative mb-4"
                style={{
                  position: "absolute",
                  top: `${cumulativeHeight + 16}px`,
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
              >
                <div className="relative shadow-lg">
                  <PDFPage
                    pdf={pdf}
                    pageNumber={pageNumber}
                    scale={viewport.scale}
                    docId={sha256 || "preview"}
                    onLoad={(w, h) => handlePageLoad(pageNumber, w, h)}
                    tool="pan"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
