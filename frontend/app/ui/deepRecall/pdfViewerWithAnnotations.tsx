// src/components/pdfViewer/pdfViewerWithAnnotations.tsx
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
import {
  Annotation,
  RectangleAnnotation,
  AnnotationType,
} from "../../types/annotationTypes";
import { AnnotationMode } from "./annotationToolbar";
import { prefixStrapiUrl } from "@/app/helpers/getStrapiMedia";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export interface PdfViewerHandle {
  scrollToPage(page: number): void;
  getPageSize(page?: number): { width: number; height: number } | null;
  getCroppedImage(annotation: RectangleAnnotation): Promise<Blob>;
}

interface Props {
  pdfUrl: string;
  zoom: number;
  pageNumber: number;
  onLoadSuccess: (info: { numPages: number }) => void;
  onVisiblePageChange?: (page: number) => void;
  annotationMode: AnnotationMode;
  annotations: Annotation[];
  selectedId: string | null;
  onCreateAnnotation: (a: Annotation) => void;
  onSelectAnnotation: (a: Annotation) => void;
  onHoverAnnotation?: (a: Annotation | null) => void;
  renderTooltip?: (annotation: Annotation) => React.ReactNode;
  resolution: number;
  colorMap: Record<AnnotationType, string>;
}

const DEFAULT_PAGE_HEIGHT = 842;

const PdfViewerWithAnnotations = forwardRef<PdfViewerHandle, Props>(
  (
    {
      pdfUrl,
      zoom,
      pageNumber,
      onLoadSuccess,
      onVisiblePageChange,
      annotationMode,
      annotations,
      selectedId,
      onCreateAnnotation,
      onSelectAnnotation,
      onHoverAnnotation,
      renderTooltip,
      resolution,
      colorMap,
    },
    ref
  ) => {
    const scrollElRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const [numPages, setNumPages] = useState(0);
    const [pageSizes, setPageSizes] = useState(
      new Map<number, { w: number; h: number }>()
    );
    const lastPageRef = useRef(1);

    const rowVirtualizer = useVirtualizer({
      count: numPages,
      overscan: 4,
      getScrollElement: () => scrollElRef.current!,
      estimateSize: (i) => {
        const pg = i + 1;
        const baseH =
          pageSizes.get(pg)?.h ?? pageSizes.get(1)?.h ?? DEFAULT_PAGE_HEIGHT;
        const h = baseH * zoom;
        return h + Math.max(1, Math.round(h * 0.002));
      },
    });

    // Scroll listener → reports only on real scrolls
    useEffect(() => {
      if (!onVisiblePageChange) return;
      const el = scrollElRef.current!;
      const handler = () => {
        const items = rowVirtualizer.getVirtualItems();
        if (items.length === 0) return;
        const scrollY = el.scrollTop;
        let cur = items[0];
        for (const it of items) {
          if (it.start <= scrollY + 1) cur = it;
          else break;
        }
        const pg = cur.index + 1;
        if (pg !== lastPageRef.current) {
          lastPageRef.current = pg;
          onVisiblePageChange(pg);
        }
      };
      el.addEventListener("scroll", handler);
      // initial trigger
      handler();
      return () => el.removeEventListener("scroll", handler);
    }, [onVisiblePageChange, rowVirtualizer]);

    useImperativeHandle(ref, () => ({
      scrollToPage: (p) =>
        rowVirtualizer.scrollToIndex(p - 1, { align: "auto" }),
      getPageSize: (p = 1) => {
        const s = pageSizes.get(p);
        return s ? { width: s.w, height: s.h } : null;
      },
      getCroppedImage: async (a) => {
        const pdf = await pdfjs.getDocument(prefixStrapiUrl(pdfUrl)).promise;
        const pgObj = await pdf.getPage(a.page);
        const viewport = pgObj.getViewport({ scale: resolution });
        const cvs = document.createElement("canvas");
        cvs.width = viewport.width;
        cvs.height = viewport.height;
        await pgObj.render({ canvasContext: cvs.getContext("2d")!, viewport })
          .promise;

        const cw = a.width * viewport.width;
        const ch = a.height * viewport.height;
        const crop = document.createElement("canvas");
        crop.width = cw;
        crop.height = ch;
        crop.getContext("2d")!.drawImage(
          cvs,
          a.x * viewport.width,
          a.y * viewport.height,
          cw,
          ch,
          0,
          0,
          cw,
          ch
        );
        return new Promise<Blob>((res) =>
          crop.toBlob((b) => res(b!), "image/png")
        );
      },
    }));

    // parent‑driven jumps
    useEffect(() => {
      if (numPages) {
        rowVirtualizer.scrollToIndex(pageNumber - 1, { align: "auto" });
      }
    }, [pageNumber, numPages, rowVirtualizer]);

    const [draft, setDraft] = useState<null | {
      page: number;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    }>(null);
    const clearDraft = () => setDraft(null);

    const handleTextSelect = useCallback(() => {
      if (annotationMode !== "text") return;
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      const pgEl = range.startContainer.parentElement?.closest(
        "[data-page-number]"
      );
      if (!pgEl) return;
      const pg = Number(pgEl.getAttribute("data-page-number"));
      const rect = range.getBoundingClientRect();
      const pr = pgEl.getBoundingClientRect();
      onCreateAnnotation({
        type: "text",
        highlightedText: sel.toString(),
        page: pg,
        x: (rect.left - pr.left) / pr.width,
        y: (rect.top - pr.top) / pr.height,
        width: rect.width / pr.width,
        height: rect.height / pr.height,
        literatureId: "",
        pdfId: "",
      });
      sel.removeAllRanges();
    }, [annotationMode, onCreateAnnotation]);

    useEffect(() => {
      document.addEventListener("mouseup", handleTextSelect);
      return () => document.removeEventListener("mouseup", handleTextSelect);
    }, [handleTextSelect]);

    const renderRow = (v: any) => {
      const pg = v.index + 1;
      return (
        <div
          key={v.key}
          data-index={v.index}
          ref={rowVirtualizer.measureElement}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${v.start}px)`,
            textAlign: "center",
          }}
        >
          <div
            data-page-number={pg}
            ref={(el) => {
              if (el) {
                pageRefs.current.set(pg, el);
              } else {
                pageRefs.current.delete(pg);
              }
            }}
            style={{ display: "inline-block", position: "relative" }}
            onMouseDown={(e) => {
              if (annotationMode !== "rectangle") return;
              const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              setDraft({
                page: pg,
                x0: e.clientX - r.left,
                y0: e.clientY - r.top,
                x1: e.clientX - r.left,
                y1: e.clientY - r.top,
              });
              e.preventDefault();
            }}
            onMouseMove={(e) => {
              if (!draft) return;
              const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              setDraft({
                ...draft,
                x1: e.clientX - r.left,
                y1: e.clientY - r.top,
              });
            }}
            onMouseUp={() => {
              if (!draft) return;
              const { w, h } = pageSizes.get(draft.page)!;
              const dispW = w * zoom;
              const dispH = h * zoom;
              const x0 = Math.min(draft.x0, draft.x1);
              const y0 = Math.min(draft.y0, draft.y1);
              const width = Math.abs(draft.x1 - draft.x0);
              const height = Math.abs(draft.y1 - draft.y0);
              onCreateAnnotation({
                type: "rectangle",
                annotationType: "Figure",
                page: draft.page,
                x: x0 / dispW,
                y: y0 / dispH,
                width: width / dispW,
                height: height / dispH,
                literatureId: "",
                pdfId: "",
              });
              clearDraft();
            }}
          >
            <Page
              pageNumber={pg}
              scale={zoom}
              onRenderSuccess={({ width, height }) => {
                const pw = width! / zoom;
                const ph = height! / zoom;
                setPageSizes((m) => {
                  const prev = m.get(pg);
                  if (prev && prev.w === pw && prev.h === ph) return m;
                  const copy = new Map(m);
                  copy.set(pg, { w: pw, h: ph });
                  return copy;
                });
              }}
            />

            <AnnotationOverlay
              annotations={annotations.filter((a) => a.page === pg)}
              selectedId={selectedId}
              pageWidth={(pageSizes.get(pg)?.w ?? 0) * zoom}
              pageHeight={(pageSizes.get(pg)?.h ?? 0) * zoom}
              onSelectAnnotation={onSelectAnnotation}
              onHoverAnnotation={onHoverAnnotation}
              renderTooltip={renderTooltip}
              colorMap={colorMap}
            />

            {draft?.page === pg && (
              <div
                style={{
                  position: "absolute",
                  left: Math.min(draft!.x0, draft!.x1),
                  top: Math.min(draft!.y0, draft!.y1),
                  width: Math.abs(draft!.x1 - draft!.x0),
                  height: Math.abs(draft!.y1 - draft!.y0),
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
      <div ref={scrollElRef} className="h-full overflow-y-auto">
        <Document
          file={prefixStrapiUrl(pdfUrl)}
          onLoadSuccess={({ numPages }) => {
            setNumPages(numPages);
            onLoadSuccess({ numPages });
          }}
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
