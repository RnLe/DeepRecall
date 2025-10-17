/**
 * PDFViewer - Full-featured PDF viewer with virtualization and annotations
 * Main component for reading and annotating PDFs
 */

"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/db/dexie";
import { usePDF } from "@/src/hooks/usePDF";
import { usePDFViewport } from "@/src/hooks/usePDFViewport";
import { PDFPage } from "./PDFPage";
import { AnnotationOverlay } from "./AnnotationOverlay";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { AnnotationHandlers } from "./AnnotationHandlers";
import { PDFScrollbar } from "./PDFScrollbar";
import { CreateNoteDialog } from "./CreateNoteDialog";
import type { Annotation } from "@/src/schema/annotation";
import * as annotationRepo from "@/src/repo/annotations";
import {
  useAnnotationUI,
  hasActiveSelection,
} from "@/src/stores/annotation-ui";
import { useReaderUI } from "@/src/stores/reader-ui";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsLeftRight,
  ChevronsUpDown,
  RotateCcw,
} from "lucide-react";

export interface PDFViewerProps {
  source: string | Uint8Array | ArrayBuffer;
  /** SHA-256 hash of PDF for annotation storage */
  sha256: string;
  className?: string;
}

/**
 * Full PDF viewer with virtualized rendering and annotation support
 * Only renders visible pages + buffer for performance
 */
export function PDFViewer({ source, sha256, className = "" }: PDFViewerProps) {
  const {
    pdf,
    numPages,
    isLoading: pdfLoading,
    error: pdfError,
  } = usePDF(source);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track programmatic scroll to prevent feedback loop
  const isProgrammaticScroll = useRef(false);

  // Annotation state
  const annotationUI = useAnnotationUI();
  const { rightSidebarOpen, toggleRightSidebar } = useReaderUI();
  const [pageAnnotations, setPageAnnotations] = useState<
    Map<number, Annotation[]>
  >(new Map());

  // Track page dimensions (unscaled) for viewport calculations
  const [pageHeights, setPageHeights] = useState<number[]>([]);
  const [pageWidths, setPageWidths] = useState<number[]>([]);
  // Page input state for editable current page
  const [pageInput, setPageInput] = useState<string>("1");

  const [showCreateNoteDialog, setShowCreateNoteDialog] = useState(false);

  // Initialize page heights array when PDF loads
  useEffect(() => {
    if (!pdf || numPages === 0) return;

    // Get first page to estimate heights (assume uniform for now)
    pdf.getPage(1).then((page) => {
      const viewport = page.getViewport({ scale: 1 });
      const estimatedHeight = viewport.height;

      // Initialize all pages with estimated height; width via viewport width
      setPageHeights(Array(numPages).fill(estimatedHeight));
      const estimatedWidth = viewport.width;
      setPageWidths(Array(numPages).fill(estimatedWidth));

      page.cleanup();
    });
  }, [pdf, numPages]);

  const viewport = usePDFViewport(numPages, pageHeights, 2);

  // Live annotations for visible pages - updates immediately on Dexie changes
  const liveAnnotationsByPage = useLiveQuery(async () => {
    const map = new Map<number, Annotation[]>();
    for (const pageNum of viewport.visiblePages) {
      const arr = await db.annotations
        .where("[sha256+page]")
        .equals([sha256, pageNum])
        .sortBy("createdAt");
      if (arr.length > 0) map.set(pageNum, arr);
    }
    return map;
  }, [sha256, viewport.visiblePages]);

  // Live query for ALL annotations in document (for scrollbar)
  const allAnnotations = useLiveQuery(async () => {
    return await db.annotations.where("sha256").equals(sha256).sortBy("page");
  }, [sha256]);

  // Update local state when live annotations change
  useEffect(() => {
    if (liveAnnotationsByPage) {
      setPageAnnotations(liveAnnotationsByPage);
    }
  }, [liveAnnotationsByPage]);

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
    const padding = 32; // match container vertical padding for symmetry
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

  // Save annotation
  const handleSaveAnnotation = useCallback(async () => {
    const { selection, selectedKind, tool } = annotationUI;
    if (!hasActiveSelection(annotationUI)) return;
    if (selection.page === null) return;

    try {
      if (selection.rectangles.length > 0) {
        // Rectangle annotation
        await annotationRepo.createAnnotation({
          sha256,
          page: selection.page,
          data: {
            type: "rectangle",
            rects: selection.rectangles,
          },
          metadata: {
            color: selection.color,
            kind: tool === "kind-rectangle" ? selectedKind : undefined,
            title: selection.title || undefined,
            notes: selection.notes || undefined,
            tags: selection.tags.length > 0 ? selection.tags : undefined,
          },
        });
      } else if (selection.textRanges.length > 0) {
        // Highlight annotation
        await annotationRepo.createAnnotation({
          sha256,
          page: selection.page,
          data: {
            type: "highlight",
            ranges: selection.textRanges,
          },
          metadata: {
            color: selection.color,
            title: selection.title || undefined,
            notes: selection.notes || undefined,
            tags: selection.tags.length > 0 ? selection.tags : undefined,
          },
        });
      }

      // Reload annotations for the page
      const annotations = await annotationRepo.getPageAnnotations(
        sha256,
        selection.page
      );
      setPageAnnotations((prev) => {
        const next = new Map(prev);
        next.set(selection.page!, annotations);
        return next;
      });

      // Clear selection
      annotationUI.clearSelection();

      // Switch to pan tool after saving
      annotationUI.setTool("pan");
    } catch (error) {
      console.error("Failed to save annotation:", error);
    }
  }, [sha256, annotationUI]);

  // Cancel annotation
  const handleCancelAnnotation = useCallback(() => {
    annotationUI.clearSelection();
    // Also deselect tool when canceling
    if (annotationUI.tool !== "pan") {
      annotationUI.setTool("pan");
    }
  }, [annotationUI]);

  // Handle annotation click
  const handleAnnotationClick = useCallback(
    (annotation: Annotation) => {
      const currentlySelected = annotationUI.selectedAnnotationId;

      // If sidebar is open and this annotation is already selected, keep it selected
      if (rightSidebarOpen && currentlySelected === annotation.id) {
        return; // Don't deselect when sidebar is open
      }

      // If sidebar is closed, toggle: deselect if already selected
      if (!rightSidebarOpen && currentlySelected === annotation.id) {
        annotationUI.setSelectedAnnotationId(null);
      } else {
        // Select the annotation
        annotationUI.setSelectedAnnotationId(annotation.id);
      }
    },
    [annotationUI, rightSidebarOpen]
  );

  // Scrollbar callbacks (must be defined at top level, not in JSX)
  const handleScrollbarScrollTo = useCallback(
    (scrollTop: number) => viewport.setScrollTop(scrollTop),
    [viewport]
  );

  const handleScrollbarAnnotationSelect = useCallback(
    (annotation: Annotation, yOffset: number) => {
      // Navigate to annotation position without selecting
      annotationUI.navigateToPage(annotation.page, yOffset);
    },
    [annotationUI]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Tool shortcuts
      if (e.key === "v" || e.key === "V") {
        annotationUI.setTool("pan");
      } else if (e.key === "r" || e.key === "R") {
        annotationUI.setTool("rectangle");
      } else if (e.key === "h" || e.key === "H") {
        annotationUI.setTool("highlight");
      } else if (e.key === "n" || e.key === "N") {
        // N: Open create note dialog for selected annotation
        e.preventDefault();
        if (annotationUI.selectedAnnotationId) {
          setShowCreateNoteDialog(true);
        }
      } else if (e.key === "Escape") {
        handleCancelAnnotation();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (hasActiveSelection(annotationUI)) {
          handleSaveAnnotation();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [annotationUI, handleCancelAnnotation, handleSaveAnnotation]);

  // Listen for navigation requests from annotation list
  useEffect(() => {
    if (annotationUI.targetPage !== null) {
      const targetPage = annotationUI.targetPage;
      const targetYOffset = annotationUI.targetYOffset;

      if (targetYOffset !== null && pageHeights.length > 0) {
        // Calculate precise scroll position
        // 1. Get cumulative height of all pages before target
        const prevPagesHeight = pageHeights
          .slice(0, targetPage - 1)
          .reduce((sum, h) => sum + h * viewport.scale + 16, 0);

        // 2. Add offset within target page (normalized y * page height)
        const pageHeight = (pageHeights[targetPage - 1] || 0) * viewport.scale;
        const yOffsetPixels = targetYOffset * pageHeight;

        // 3. Subtract a small buffer (few pixels below top) for better visibility
        const buffer = 20; // 20px below top edge

        const scrollTop = prevPagesHeight + 16 + yOffsetPixels - buffer;
        viewport.setScrollTop(Math.max(0, scrollTop));
      } else {
        // No y-offset provided, just go to page start
        viewport.goToPage(targetPage);
      }

      annotationUI.clearTargetPage();
    }
  }, [
    annotationUI,
    annotationUI.targetPage,
    annotationUI.targetYOffset,
    pageHeights,
    viewport,
  ]);

  // Calculate total height for virtual scrolling
  const totalHeight = useMemo(() => {
    const scaledHeights = pageHeights.map((h) => h * viewport.scale);
    return scaledHeights.reduce((sum, h) => sum + h + 16, 0); // 16px gap
  }, [pageHeights, viewport.scale]);

  if (pdfLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-lg text-gray-600">Loading PDF...</div>
      </div>
    );
  }

  if (pdfError) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-lg text-red-600">
          Failed to load PDF: {pdfError.message}
        </div>
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-lg text-gray-600">No PDF loaded</div>
      </div>
    );
  }

  return (
    <div className={`pdf-viewer flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="pdf-toolbar flex items-center gap-4 p-3 bg-gray-800 border-b border-gray-700">
        {/* Left: Zoom & Fit */}
        <div className="flex items-center gap-1">
          <button
            onClick={viewport.zoomOut}
            disabled={viewport.scale <= 0.5}
            className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 text-sm font-medium transition-colors"
            title="Zoom out"
          >
            −
          </button>

          <span className="text-sm w-12 text-center text-gray-300 font-medium">
            {Math.round(viewport.scale * 100)}%
          </span>

          <button
            onClick={viewport.zoomIn}
            disabled={viewport.scale >= 4}
            className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 text-sm font-medium transition-colors"
            title="Zoom in"
          >
            +
          </button>

          <div className="h-5 w-px bg-gray-700 mx-1" />

          <button
            onClick={fitToWidth}
            className="p-1.5 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 text-gray-200 transition-colors"
            title="Fit to width"
          >
            <ChevronsLeftRight className="w-4 h-4" />
          </button>
          <button
            onClick={fitToHeight}
            className="p-1.5 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 text-gray-200 transition-colors"
            title="Fit to height"
          >
            <ChevronsUpDown className="w-4 h-4" />
          </button>
          {Math.round(viewport.scale * 100) !== 100 && (
            <button
              onClick={viewport.resetZoom}
              className="p-1.5 bg-purple-600 border border-purple-500 rounded hover:bg-purple-700 text-white transition-colors"
              title="Reset zoom to 100%"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Center: Page navigation */}
        <div className="flex-1 flex items-center justify-center gap-2">
          <button
            onClick={() => viewport.goToPage(1)}
            disabled={viewport.currentPage === 1}
            className="px-2 py-1 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 disabled:opacity-40 text-gray-200"
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={viewport.prevPage}
            disabled={viewport.currentPage === 1}
            className="px-2 py-1 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 disabled:opacity-40 text-gray-200"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 text-gray-300 text-sm">
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
              className="w-16 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-gray-200 text-center"
              inputMode="numeric"
            />
            <span className="opacity-70">/ {numPages}</span>
          </div>

          <button
            onClick={viewport.nextPage}
            disabled={viewport.currentPage === numPages}
            className="px-2 py-1 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 disabled:opacity-40 text-gray-200"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => viewport.goToPage(numPages)}
            disabled={viewport.currentPage === numPages}
            className="px-2 py-1 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 disabled:opacity-40 text-gray-200"
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>

        {/* Annotation Toolbar */}
        <AnnotationToolbar
          onSave={handleSaveAnnotation}
          onCancel={handleCancelAnnotation}
        />
      </div>

      {/* Scrollable content wrapper - relative positioning for fixed scrollbar */}
      <div className="flex-1 relative">
        <div
          ref={containerRef}
          className="pdf-container absolute inset-0 overflow-auto bg-gray-900"
          style={{
            scrollbarWidth: "none", // Firefox
            msOverflowStyle: "none", // IE/Edge
          }}
          onClick={(e) => {
            // Priority 1: Close context menu if open (checked via AnnotationOverlay state)
            // Priority 2: Close right sidebar if clicking on container background (the void)
            const hasOpenMenu = (AnnotationOverlay as any)._hasOpenMenu;

            if (hasOpenMenu) {
              // Context menu is open - don't close sidebar, just let menu handle it
              return;
            }

            if (
              e.target === e.currentTarget ||
              (e.target as HTMLElement).classList.contains(
                "pdf-pages-container"
              )
            ) {
              // Always unselect annotation
              annotationUI.setSelectedAnnotationId(null);
              // Close sidebar if it's open
              if (rightSidebarOpen) {
                toggleRightSidebar();
              }
            }
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
              const annotations = pageAnnotations.get(pageNumber) || [];
              const cumulativeHeight = pageHeights
                .slice(0, pageNumber - 1)
                .reduce((sum, h) => sum + h * viewport.scale + 16, 0);
              const pageWidth =
                (pageWidths[pageNumber - 1] ?? 0) * viewport.scale;
              const pageHeight =
                (pageHeights[pageNumber - 1] ?? 0) * viewport.scale;

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
                  onClick={(e) => {
                    // Priority 1: Close context menu if open
                    // Priority 2: Deselect annotation if clicking outside annotations and links
                    const hasOpenMenu = (AnnotationOverlay as any)._hasOpenMenu;

                    if (hasOpenMenu) {
                      // Context menu is open - don't close sidebar
                      return;
                    }

                    const target = e.target as HTMLElement;

                    // Don't deselect if clicking on a link
                    if (
                      target.classList.contains("pdf-link") ||
                      target.closest(".pdf-link")
                    ) {
                      return;
                    }

                    // Check if click is on page background (not on annotation, link, or interactive element)
                    const isBackground =
                      target === e.currentTarget ||
                      target.tagName === "CANVAS" ||
                      target.classList.contains("pdf-text-layer") ||
                      target.classList.contains("pdf-annotation-layer") ||
                      target.closest(".pdf-text-layer") !== null ||
                      target.closest(".pdf-annotation-layer") !== null;

                    if (isBackground) {
                      // Deselect annotation when clicking page background
                      annotationUI.setSelectedAnnotationId(null);
                      // Close sidebar if it's open
                      if (rightSidebarOpen) {
                        toggleRightSidebar();
                      }
                    }
                  }}
                >
                  <AnnotationHandlers
                    page={pageNumber}
                    pageWidth={pageWidth}
                    pageHeight={pageHeight}
                    containerRef={containerRef}
                  >
                    <div className="relative shadow-lg">
                      <PDFPage
                        pdf={pdf}
                        pageNumber={pageNumber}
                        scale={viewport.scale}
                        docId={sha256}
                        onLoad={(w, h) => handlePageLoad(pageNumber, w, h)}
                        tool={annotationUI.tool}
                      />

                      {/* Annotation overlay */}
                      {pageHeights[pageNumber - 1] && (
                        <AnnotationOverlay
                          sha256={sha256}
                          page={pageNumber}
                          annotations={annotations}
                          pageWidth={pageWidth}
                          pageHeight={pageHeight}
                          tool={annotationUI.tool}
                          onAnnotationClick={handleAnnotationClick}
                          onSave={handleSaveAnnotation}
                          onCancel={handleCancelAnnotation}
                        />
                      )}
                    </div>
                  </AnnotationHandlers>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom scrollbar with viewport indicator and annotation markers */}
        {allAnnotations && (
          <PDFScrollbar
            totalHeight={totalHeight}
            pageHeights={pageHeights.map((h) => h * viewport.scale)}
            scrollTop={viewport.scrollTop}
            containerHeight={viewport.containerHeight}
            annotations={allAnnotations}
            scale={viewport.scale}
            onScrollTo={handleScrollbarScrollTo}
            onAnnotationSelect={handleScrollbarAnnotationSelect}
          />
        )}
      </div>

      {/* Create Note Dialog */}
      {showCreateNoteDialog && annotationUI.selectedAnnotationId && (
        <CreateNoteDialog
          annotationId={annotationUI.selectedAnnotationId}
          onClose={() => setShowCreateNoteDialog(false)}
          onNoteCreated={() => {
            setShowCreateNoteDialog(false);
            // Notes will auto-reload via live query
          }}
        />
      )}
    </div>
  );
}
