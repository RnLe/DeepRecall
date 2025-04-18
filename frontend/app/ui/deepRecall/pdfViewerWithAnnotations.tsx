// pdfViewerWithAnnotations.tsx
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

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export interface PdfViewerHandle {
  scrollToPage(page: number): void;
  getPageSize(page?: number): { width: number; height: number } | null;
  /** New: smoothly center a given annotation in view */
  scrollToAnnotation(annotation: Annotation): void;
}

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
  onHoverAnnotation?: (a: Annotation | null) => void;
  /** Optional: render any React node as the hover‑tooltip */
  renderTooltip?: (annotation: Annotation) => React.ReactNode;
}

const DEFAULT_PAGE_HEIGHT = 842;

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
      onHoverAnnotation,
      renderTooltip,
    },
    ref
  ) => {
    const scrollParentRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const [numPages, setNumPages] = useState(0);
    const [pageSizes, setPageSizes] = useState(
      new Map<number, { w: number; h: number }>()
    );

    const rowVirtualizer = useVirtualizer({
      count: numPages,
      overscan: 3,
      getScrollElement: () => scrollParentRef.current!,
      estimateSize: (index) => {
        const pg = index + 1;
        const measured = pageSizes.get(pg)?.h;
        const baseHeight =
          measured ?? pageSizes.get(1)?.h ?? DEFAULT_PAGE_HEIGHT;
        const gap = Math.max(1, Math.round(baseHeight * 0.002));
        return baseHeight + gap;
      },
    });

    useEffect(() => {
      rowVirtualizer.measure();
    }, [zoom, pageSizes, rowVirtualizer]);

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
      scrollToAnnotation: (a: Annotation) => {
        const pg = a.page;
        const sizes = pageSizes.get(pg);
        if (!sizes) return;
        const items = rowVirtualizer.getVirtualItems();
        const item = items.find((v) => v.index === pg - 1);
        if (!item) return;
        const pageStart = item.start;
        const annOffset = a.y * sizes.h;
        const annCenter = annOffset + (a.height * sizes.h) / 2;
        const container = scrollParentRef.current;
        if (!container) return;
        const containerH = container.clientHeight;
        const target = pageStart + annCenter - containerH / 2;
        container.scrollTo({ top: target, behavior: "smooth" });
      },
    }));

    useEffect(() => {
      if (numPages) {
        rowVirtualizer.scrollToIndex(pageNumber - 1, { align: "start" });
      }
    }, [pageNumber, numPages, rowVirtualizer]);

    // rectangle‐drawing draft
    const [draft, setDraft] = useState<null | {
      page: number;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    }>(null);
    const clearDraft = () => setDraft(null);

    const mouseDown = (e: React.MouseEvent, pg: number) => {
      if (annotationMode !== "rectangle") return;
      const node = pageRefs.current.get(pg);
      if (!node) return;
      const r = node.getBoundingClientRect();
      setDraft({
        page: pg,
        x0: e.clientX - r.left,
        y0: e.clientY - r.top,
        x1: e.clientX - r.left,
        y1: e.clientY - r.top,
      });
      e.preventDefault();
    };
    const mouseMove = (e: React.MouseEvent) => {
      if (!draft) return;
      const node = pageRefs.current.get(draft.page);
      if (!node) return;
      const r = node.getBoundingClientRect();
      setDraft({
        ...draft,
        x1: e.clientX - r.left,
        y1: e.clientY - r.top,
      });
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

    // text‐highlight
    const handleTextSelect = useCallback(() => {
      if (annotationMode !== "text") return;
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      const pgDiv = range.startContainer.parentElement?.closest(
        "[data-page-number]"
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
      return () => {
        document.removeEventListener("mouseup", handleTextSelect);
      };
    }, [handleTextSelect]);

    const renderRow = (
      vRow: ReturnType<typeof rowVirtualizer.getVirtualItems>[number]
    ) => {
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
              onHoverAnnotation={onHoverAnnotation}
              renderTooltip={renderTooltip}
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
          onItemClick={({ pageNumber }) =>
            rowVirtualizer.scrollToIndex(pageNumber - 1, {
              align: "start",
              behavior: "smooth",
            })
          }
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
  }
);

export default PdfViewerWithAnnotations;