// src/components/pdfViewer/pdfViewerWithAnnotations.tsx
// Enhanced PDF viewer with virtualization, smooth jumps, accurate offsets,
// in-place annotation creation, and restored sizing logic.

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useMemo,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useVirtualizer, VirtualItem } from "@tanstack/react-virtual";
import throttle from "lodash/throttle";
import debounce from "lodash/debounce";

import AnnotationOverlay from "../annotationOverlay";
import { Annotation, AnnotationType } from "@/app/types/deepRecall/strapi/annotationTypes";
import { AnnotationMode } from "../annotationToolbar";
import { prefixStrapiUrl } from "@/app/helpers/getStrapiMedia";

// Configure PDF.js worker via ESM URL
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// Fallback height (A4 @ 72 dpi) for intrinsic measurements
const DEFAULT_PAGE_HEIGHT = 792;

export interface PdfViewerHandle {
  scrollToPage(page: number): void;
  getPageSize(page?: number): { width: number; height: number } | null;
  getCroppedImage(annotation: Annotation): Promise<Blob>;
}

interface Props {
  pdfUrl: string;
  zoom: number;
  onLoadSuccess: (info: { numPages: number }) => void;
  onVisiblePageChange?: (page: number) => void;
  annotationMode: AnnotationMode;
  annotations: Annotation[];
  selectedId: string | null;
  onCreateAnnotation: (a: Annotation) => void;
  onSelectAnnotation: (a: Annotation | null) => void;
  onHoverAnnotation: (a: Annotation | null) => void;
  renderTooltip?: (annotation: Annotation) => React.ReactNode;
  resolution: number;
  colorMap: Record<AnnotationType, string>;
  onToolUsed?: () => void;
}

const PdfViewerWithAnnotations = forwardRef<PdfViewerHandle, Props>(
  (
    {
      pdfUrl,
      zoom,
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
      onToolUsed,
    },
    ref
  ) => {
    // ───── Refs ─────
    const scrollElRef = useRef<HTMLDivElement>(null);
    const pageSizeRef = useRef(new Map<number, { w: number; h: number }>());
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const lastPageRef = useRef(1);
    const isProgrammaticRef = useRef(false);
    const offsetsRef = useRef<number[]>([]);

    // ───── State ─────
    const [numPages, setNumPages] = useState(0);
    const [tick, setTick] = useState(0);
    const [basePageHeight, setBasePageHeight] = useState<number>(
      DEFAULT_PAGE_HEIGHT
    );

    // ───── Virtualizer setup ─────
    const initialOverscan = 2;
    const options = useMemo(
      () => ({
        count: numPages,
        getScrollElement: () => scrollElRef.current!,
        estimateSize: (index: number) => {
          const intrinsic =
            pageSizeRef.current.get(index + 1)?.h ?? basePageHeight;
          const px = intrinsic * zoom;
          // Changed: re‑introduced a small "gap" to prevent flicker
          const gap = Math.max(1, Math.round(px * 0.002));
          return px + gap;
        },
        overscan: initialOverscan,
      }),
      [numPages, basePageHeight, zoom]
    );
    const rowVirtualizer = useVirtualizer(options);

    // ───── Helpers ─────
    const recalcOffsets = () => {
      const arr: number[] = [];
      let acc = 0;
      for (let i = 1; i <= numPages; i++) {
        arr[i - 1] = acc;
        const intr = pageSizeRef.current.get(i);
        const h = intr ? intr.h * zoom : basePageHeight * zoom;
        acc += h;
      }
      offsetsRef.current = arr;
    };

    const debouncedMeasure = useMemo(
      () =>
        debounce(() => {
          rowVirtualizer.measure();
          recalcOffsets();
        }, 50),
      [rowVirtualizer]
    );
    useEffect(() => debouncedMeasure(), [zoom, debouncedMeasure]);

    // ───── Imperative methods ─────
    useImperativeHandle(ref, () => ({
      scrollToPage: (targetPage: number) => {
        const distance = Math.abs(targetPage - lastPageRef.current);
        // Changed: use virtualizer to scroll instead of manual scrollTop
        if (distance > 6) {
          rowVirtualizer.setOptions({
            ...rowVirtualizer.options,
            overscan: distance + 2,
          });
        }
        isProgrammaticRef.current = true;
        rowVirtualizer.scrollToIndex(targetPage - 1, {
          align: "start",
          behavior: "smooth",
        });
        setTimeout(() => {
          isProgrammaticRef.current = false;
          if (distance > 6) {
            rowVirtualizer.setOptions({
              ...rowVirtualizer.options,
              overscan: initialOverscan,
            });
          }
        }, 100);
      },

      getPageSize(page = 1) {
        const s = pageSizeRef.current.get(page);
        return s ? { width: s.w, height: s.h } : null;
      },

      async getCroppedImage(a: Annotation) {
        const pdf = await pdfjs.getDocument(
          prefixStrapiUrl(pdfUrl)
        ).promise;
        const pgObj = await pdf.getPage(a.page);
        const viewport = pgObj.getViewport({ scale: resolution });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await pgObj
          .render({
            canvasContext: canvas.getContext("2d")!,
            viewport,
          })
          .promise;

        const crop = document.createElement("canvas");
        crop.width = a.width * viewport.width;
        crop.height = a.height * viewport.height;
        crop
          .getContext("2d")!
          .drawImage(
            canvas,
            a.x * viewport.width,
            a.y * viewport.height,
            crop.width,
            crop.height,
            0,
            0,
            crop.width,
            crop.height
          );

        return new Promise<Blob>((res) =>
          crop.toBlob((b) => res(b!), "image/png")
        );
      },
    }));

    // ───── Sync effects ─────
    useEffect(() => {
      options.count = numPages;
      rowVirtualizer.setOptions({
        ...rowVirtualizer.options,
        count: numPages,
      });
      recalcOffsets();
      rowVirtualizer.measure();
    }, [numPages]);

    useEffect(() => {
      // Update estimateSize on zoom change
      rowVirtualizer.setOptions({
        ...rowVirtualizer.options,
        estimateSize: (index: number) => {
          const intrinsic =
            pageSizeRef.current.get(index + 1)?.h ?? basePageHeight;
          const px = intrinsic * zoom;
          const gap = Math.max(1, Math.round(px * 0.002));
          return px + gap;
        },
      });

      recalcOffsets();
      rowVirtualizer.measure();

      // Preserve scroll ratio
      const el = scrollElRef.current!;
      const ratio = el.scrollTop / (rowVirtualizer.getTotalSize() || 1);
      requestAnimationFrame(() => {
        el.scrollTop = ratio * rowVirtualizer.getTotalSize();
      });
    }, [zoom]);

    // ───── Annotation handlers ─────
    const [draft, setDraft] = useState<
      | null
      | { page: number; x0: number; y0: number; x1: number; y1: number }
    >(null);
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
        mode: "text",
        type: "Definition",
        textContent: sel.toString(),
        page: pg,
        x: (rect.left - pr.left) / pr.width,
        y: (rect.top - pr.top) / pr.height,
        width: rect.width / pr.width,
        height: rect.height / pr.height,
        literatureId: "",
        pdfId: "",
        annotation_tags: [],
        annotation_groups: [],
      });
      onToolUsed?.();
      sel.removeAllRanges();
    }, [annotationMode, onCreateAnnotation, onToolUsed]);

    useEffect(() => {
      document.addEventListener("mouseup", handleTextSelect);
      return () => document.removeEventListener("mouseup", handleTextSelect);
    }, [handleTextSelect]);

    // 1) Detect true visible‐page changes
    const handleScroll = useCallback(() => {
      const items = rowVirtualizer.getVirtualItems();
      if (items.length === 0) return;
      const currentPage = items[0].index + 1;
      if (currentPage !== lastPageRef.current) {
        lastPageRef.current = currentPage;
        onVisiblePageChange?.(currentPage);
      }
    }, [onVisiblePageChange, rowVirtualizer]);

    // ───── Row renderer ─────
    const renderRow = (v: VirtualItem) => {
      const pg = v.index + 1;
      return (
        <div
          key={v.key}
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
                rowVirtualizer.measureElement(el);
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
              setDraft({ ...draft, x1: e.clientX - r.left, y1: e.clientY - r.top });
            }}
            onMouseUp={() => {
              if (!draft) return;
              const { w, h } = pageSizeRef.current.get(draft.page)!;
              const dispW = w * zoom;
              const dispH = h * zoom;

              const x0 = Math.min(draft.x0, draft.x1);
              const y0 = Math.min(draft.y0, draft.y1);
              const width = Math.abs(draft.x1 - draft.x0);
              const height = Math.abs(draft.y1 - draft.y0);

              onCreateAnnotation({
                mode: "rectangle",
                type: "Figure",
                page: draft.page,
                x: x0 / dispW,
                y: y0 / dispH,
                width: width / dispW,
                height: height / dispH,
                literatureId: "",
                pdfId: "",
                annotation_tags: [],
                annotation_groups: [],
              });
              onToolUsed?.();
              clearDraft();
            }}
          >
            <Page
              pageNumber={pg}
              scale={zoom}
              onRenderSuccess={({ width, height }) => {
                // Changed: restore old logic of capturing exact CSS px sizes
                const intrinsicW = width / zoom;
                const intrinsicH = height / zoom;
                if (!pageSizeRef.current.has(pg)) {
                  pageSizeRef.current.set(pg, { w: intrinsicW, h: intrinsicH });
                  // Prime basePageHeight on first page render
                  setBasePageHeight((prev) =>
                    prev === DEFAULT_PAGE_HEIGHT ? intrinsicH : prev
                  );
                  recalcOffsets();
                  rowVirtualizer.measure();
                  setTick((t) => t + 1); // refresh overlays
                }
              }}
            />

            <AnnotationOverlay
              key={tick}
              annotations={annotations.filter((a) => a.page === pg)}
              selectedId={selectedId}
              // Changed: pass CSS px sizes for correct overlay scaling
              pageWidth={(pageSizeRef.current.get(pg)?.w ?? 0) * zoom}
              pageHeight={(pageSizeRef.current.get(pg)?.h ?? 0) * zoom}
              onSelectAnnotation={onSelectAnnotation}
              onHoverAnnotation={onHoverAnnotation}
              renderTooltip={renderTooltip}
              colorMap={colorMap}
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
        ref={scrollElRef}
        className="h-full overflow-y-auto overflow-x-hidden"
        onClick={() => onSelectAnnotation(null)}
        onScroll={handleScroll}           // 2) hook up scroll handler
      >
        <div onClick={(e) => e.stopPropagation()}></div>
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

export default React.memo(PdfViewerWithAnnotations);
