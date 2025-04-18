// pdfViewerWithAnnotations.tsx – virtualised (v2‑compatible)
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useVirtualizer } from "@tanstack/react-virtual";

import AnnotationOverlay from "./annotationOverlay";
import { Annotation } from "../../types/annotationTypes";
import { AnnotationMode } from "./annotationToolbar";
import { prefixStrapiUrl } from "@/app/helpers/getStrapiMedia";

/* ------------------------------------------------------------- */
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
/* ------------------------------------------------------------- */

interface Props {
  pdfUrl: string;
  zoom: number;
  pageNumber: number;
  onLoadSuccess: (info: { numPages: number }) => void;
  annotationMode: AnnotationMode;
  annotations: Annotation[];
  selectedId: string | null;
  onCreateAnnotation: (a: Annotation) => void;
  onSelectAnnotation: (a: Annotation) => void;
}

export interface PdfViewerHandle {
  scrollToPage(page: number): void;
  getPageSize(page?: number): { width: number; height: number } | null;
}

const DEFAULT_PAGE_HEIGHT = 842;  // fallback for A4 if we have no measurements yet

const PdfViewerWithAnnotations = forwardRef<PdfViewerHandle, Props>(
  (
    {
      pdfUrl,
      zoom,
      pageNumber,
      onLoadSuccess,
      annotationMode,
      annotations,
      selectedId,
      onCreateAnnotation,
      onSelectAnnotation,
    },
    ref
  ) => {
    /* ---------------- refs & state ------------------------------ */
    const scrollParentRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const [numPages, setNumPages] = useState(0);
    const [pageSizes, setPageSizes] = useState(
      new Map<number, { w: number; h: number }>(),
    );

    /* ---------------- virtualiser (v2 API) ---------------------- */
    const rowVirtualizer = useVirtualizer({
      count: numPages,
      overscan: 3,
      getScrollElement: () => scrollParentRef.current!,
      estimateSize: (index) => {
        // page index is zero‑based; our map is 1‑based
        const pg = index + 1;
        // use measured height if we have it
        const measured = pageSizes.get(pg)?.h;
        const baseHeight = measured ?? pageSizes.get(1)?.h ?? DEFAULT_PAGE_HEIGHT;
        // dynamic, very small gap: 0.2% of page height, minimum 1px
        const dynamicGap = Math.max(1, Math.round(baseHeight * 0.002));
        return baseHeight + dynamicGap;
      },
    });

    /* whenever zoom or pageSizes change, re‑measure everything */
    useEffect(() => {
      rowVirtualizer.measure();
    }, [zoom, pageSizes, rowVirtualizer]);

    /* ---------------- expose handle ---------------------------- */
    useImperativeHandle(ref, () => ({
      scrollToPage: (p: number) =>
        rowVirtualizer.scrollToIndex(p - 1, {
          align: "start",
          behavior: "smooth",
        }),
      getPageSize: (p = 1) => {
        const size = pageSizes.get(p);
        return size ? { width: size.w, height: size.h } : null;
      },
    }));

    /* auto‑scroll when external pageNumber prop changes */
    useEffect(() => {
      if (numPages) {
        rowVirtualizer.scrollToIndex(pageNumber - 1, { align: "start" });
      }
    }, [pageNumber, numPages, rowVirtualizer]);

    /* ---------------- draft state for rectangle draw ----------- */
    const [draft, setDraft] = useState<null | {
      page: number;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    }>(null);
    const clearDraft = () => setDraft(null);

    /* ---------------- mouse handlers (unchanged) --------------- */
    const mouseDown = (e: React.MouseEvent, pg: number) => {
      if (annotationMode !== "rectangle") return;
      const node = pageRefs.current.get(pg);
      if (!node) return;
      const r = node.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      setDraft({ page: pg, x0: x, y0: y, x1: x, y1: y });
      e.preventDefault();
    };
    const mouseMove = (e: React.MouseEvent) => {
      if (!draft) return;
      const node = pageRefs.current.get(draft.page);
      if (!node) return;
      const r = node.getBoundingClientRect();
      setDraft({ ...draft, x1: e.clientX - r.left, y1: e.clientY - r.top });
    };
    const mouseUp = () => {
      if (!draft) return;
      const { w, h } = pageSizes.get(draft.page)!;
      const xMin = Math.min(draft.x0, draft.x1);
      const yMin = Math.min(draft.y0, draft.y1);
      const xMax = Math.max(draft.x0, draft.x1);
      const yMax = Math.max(draft.y0, draft.y1);

      onCreateAnnotation({
        type: "rectangle",
        annotationKind: "Figure",
        page: draft.page,
        x: xMin / w,
        y: yMin / h,
        width: (xMax - xMin) / w,
        height: (yMax - yMin) / h,
        literatureId: "",
        pdfId: "",
      });
      clearDraft();
    };

    /* ---------------- text highlight (unchanged) -------------- */
    const handleTextSelect = useCallback(() => {
      if (annotationMode !== "text") return;
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed) return;

      const range = sel.getRangeAt(0);
      const pgDiv = range.startContainer.parentElement?.closest(
        "[data-page-number]",
      );
      if (!pgDiv) return;
      const pg = Number(pgDiv.getAttribute("data-page-number"));
      const { w, h } = pageSizes.get(pg)!;
      const rect = range.getBoundingClientRect();
      const pr = pgDiv.getBoundingClientRect();

      onCreateAnnotation({
        type: "text",
        highlightedText: sel.toString(),
        page: pg,
        x: (rect.left - pr.left) / w,
        y: (rect.top - pr.top) / h,
        width: rect.width / w,
        height: rect.height / h,
        literatureId: "",
        pdfId: "",
      });
      sel.removeAllRanges();
    }, [annotationMode, onCreateAnnotation, pageSizes]);

    useEffect(() => {
      document.addEventListener("mouseup", handleTextSelect);
      return () =>
        document.removeEventListener("mouseup", handleTextSelect);
    }, [handleTextSelect]);

    /* ---------------- render a single virtual row -------------- */
    const renderRow = (vRow: ReturnType<
      typeof rowVirtualizer.getVirtualItems
    >[number]) => {
      const pg = vRow.index + 1;
      return (
        <div
          key={vRow.key}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${vRow.start}px)`,
            textAlign: "center",
          }}
        >
          <div
            data-page-number={pg}
            ref={(el) => {
              if (el) {
                pageRefs.current.set(pg, el);
                rowVirtualizer.measureElement(el);
              } else {
                pageRefs.current.delete(pg);
              }
            }}
            style={{ display: "inline-block", position: "relative" }}
            onMouseDown={(e) => mouseDown(e, pg)}
            onMouseMove={mouseMove}
            onMouseUp={mouseUp}
          >
            <Page
              pageNumber={pg}
              scale={zoom}
              onRenderSuccess={({ width, height }) => {
                setPageSizes((m) => {
                  const copy = new Map(m);
                  copy.set(pg, { w: width!, h: height! });
                  return copy;
                });
                // re‑measure now that height is known
                const node = pageRefs.current.get(pg);
                if (node) rowVirtualizer.measureElement(node);
              }}
            />
            <AnnotationOverlay
              annotations={annotations.filter((a) => a.page === pg)}
              selectedId={selectedId}
              pageWidth={pageSizes.get(pg)?.w ?? 0}
              pageHeight={pageSizes.get(pg)?.h ?? 0}
              onSelectAnnotation={onSelectAnnotation}
            />
            {draft?.page === pg && (
              <div
                style={{
                  position: "absolute",
                  left: Math.min(draft.x0, draft.x1),
                  top: Math.min(draft.y0, draft.y1),
                  width: Math.abs(draft.x1 - draft.x0),
                  height: Math.abs(draft.y1 - draft.y0),
                  border: "2px dashed red",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
        </div>
      );
    };

    /* ---------------- render container -------------------------- */
    return (
      <div
        ref={scrollParentRef}
        className="h-full overflow-y-auto"
        style={{ cursor: annotationMode === "none" ? "grab" : undefined }}
      >
        <Document
          file={prefixStrapiUrl(pdfUrl)}
          onLoadSuccess={({ numPages }) => {
            setNumPages(numPages);
            onLoadSuccess({ numPages });
          }}
          // ← FIX #1: handle internal links
          onItemClick={({ pageNumber }) =>
            rowVirtualizer.scrollToIndex(pageNumber - 1, {
              align: "start",
              behavior: "smooth",
            })
          }
          loading={<div className="p-4">Loading PDF…</div>}
          error={<div className="p-4 text-red-600">Failed to load PDF.</div>}
        >
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map(renderRow)}
          </div>
        </Document>
      </div>
    );
  },
);

export default PdfViewerWithAnnotations;
