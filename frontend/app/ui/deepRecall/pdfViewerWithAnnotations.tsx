// src/components/pdfViewer/pdfViewerWithAnnotations.tsx
/**
 * Enhanced PDF viewer with virtualization, smooth jumps, and accurate offsets.
 * Implements:
 *  • Exact scroll offsets for programmatic jumps
 *  • Dynamic average-based estimate for reducing overshoot
 *  • Adaptive overscan for large jumps
 *  • Guard against onVisiblePageChange feedback on programmatic scrolls
 *  • Minimized React state churn; page sizes in refs
 */

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

import AnnotationOverlay from "./annotationOverlay";
import {
  Annotation,
  AnnotationType,
  RectangleAnnotation,
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
  onSelectAnnotation: (a: Annotation | null) => void;
  onHoverAnnotation?: (a: Annotation | null) => void;
  renderTooltip?: (annotation: Annotation) => React.ReactNode;
  resolution: number;
  colorMap: Record<AnnotationType, string>;
  onToolUsed?: () => void;    // <-- new
}

const DEFAULT_PAGE_HEIGHT = 842;

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
      onToolUsed,              // <-- new
    },
    ref
  ) => {
    // Refs for stable values
    const scrollElRef = useRef<HTMLDivElement>(null);
    const pageSizeRef = useRef(new Map<number, { w: number; h: number }>());
    const lastPageRef = useRef(1);
    const isProgrammaticRef = useRef(false);
    const offsetsRef = useRef<number[]>([]);
    const sumHeightsRef = useRef(0);
    const countRef = useRef(0);
    const initialOverscan = 6; // default overscan for react-virtual

    // Force overlay recalculation
    const [tick, setTick] = useState(0);
    const [numPages, setNumPages] = useState(0);


    // 1. Create a ref for your options
    const optionsRef = useRef({
      count: numPages,
      getScrollElement: () => scrollElRef.current!,
      estimateSize: () => DEFAULT_PAGE_HEIGHT * zoom,
      overscan: initialOverscan,
    });

    // 2. Pass it to the hook
    const rowVirtualizer = useVirtualizer(optionsRef.current);

    // Debounced measure after zoom
    const debouncedMeasure = useMemo(
      () => debounce(() => {
        rowVirtualizer.measure();
        recalcOffsets();
      }, 50),
      [rowVirtualizer]
    );
    useEffect(() => debouncedMeasure(), [zoom, debouncedMeasure]);

    // Compute cumulative offsets
    const recalcOffsets = () => {
      const arr: number[] = [];
      let acc = 0;
      for (let i = 1; i <= numPages; i++) {
        arr[i - 1] = acc;
        const size = pageSizeRef.current.get(i);
        const h = size ? size.h * zoom : DEFAULT_PAGE_HEIGHT * zoom;
        acc += h;
      }
      offsetsRef.current = arr;
    };

    // Imperative handle
    useImperativeHandle(ref, () => ({
      scrollToPage: (p: number) => {
        const current = lastPageRef.current;
        const distance = Math.abs(p - current);
        // adjust overscan for large jumps
        if (distance > 6) {
          rowVirtualizer.setOptions({
            ...rowVirtualizer.options,
            overscan: distance + 2,
          });
        }
        // programmatic scroll
        const offset = offsetsRef.current[p - 1] ?? (p - 1) * DEFAULT_PAGE_HEIGHT * zoom;
        isProgrammaticRef.current = true;
        scrollElRef.current!.scrollTop = offset;
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
      getPageSize: (p = 1) => {
        const s = pageSizeRef.current.get(p);
        return s ? { width: s.w, height: s.h } : null;
      },
      async getCroppedImage(a: RectangleAnnotation) {
        const pdf = await pdfjs.getDocument(prefixStrapiUrl(pdfUrl)).promise;
        const pgObj = await pdf.getPage(a.page);
        const viewport = pgObj.getViewport({ scale: resolution });
        const cvs = document.createElement("canvas");
        cvs.width = viewport.width;
        cvs.height = viewport.height;
        await pgObj.render({ canvasContext: cvs.getContext("2d")!, viewport }).promise;
        const crop = document.createElement("canvas");
        crop.width = a.width * viewport.width;
        crop.height = a.height * viewport.height;
        crop.getContext("2d")!.drawImage(
          cvs,
          a.x * viewport.width,
          a.y * viewport.height,
          crop.width,
          crop.height,
          0,
          0,
          crop.width,
          crop.height
        );
        return new Promise<Blob>((res) => crop.toBlob((b) => res(b!), "image/png"));
      },
    }));

    // Scroll listener with guard
    useEffect(() => {
      if (!onVisiblePageChange) return;
      const el = scrollElRef.current!;
      const handler = throttle(() => {
        if (isProgrammaticRef.current) return;
        const items = rowVirtualizer.getVirtualItems();
        if (!items.length) return;
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
      }, 200, { trailing: true });
      el.addEventListener("scroll", handler);
      handler();
      return () => el.removeEventListener("scroll", handler);
    }, [onVisiblePageChange, rowVirtualizer]);

    // ------------------------------------------------------------
    // keep virtualizer in sync with page count (and recalc offsets)
    useEffect(() => {
        optionsRef.current.count = numPages;
        rowVirtualizer.setOptions({
          ...rowVirtualizer.options,
          count: numPages,
        });
        recalcOffsets();
        rowVirtualizer.measure();
    }, [numPages, rowVirtualizer]);
    
    // refresh estimateSize when zoom changes
    useEffect(() => {
      rowVirtualizer.setOptions({
        ...rowVirtualizer.options,
        estimateSize: () => DEFAULT_PAGE_HEIGHT * zoom,
      });
      debouncedMeasure();
    }, [zoom]);

    /*************************************************************************
     * 5 Helpers for text and rectangle annotation creation
     *************************************************************************/
    const [draft, setDraft] = useState<null | { page: number; x0: number; y0: number; x1: number; y1: number }>(null);
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
        annotationType: "Text Highlight",
        highlightedText: sel.toString(),
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
      onToolUsed?.();                    // <-- call tool‐deselect
      sel.removeAllRanges();
    }, [annotationMode, onCreateAnnotation, onToolUsed]);

    useEffect(() => {
      document.addEventListener("mouseup", handleTextSelect);
      return () => document.removeEventListener("mouseup", handleTextSelect);
    }, [handleTextSelect]);

    /*************************************************************************
     * 6 Row renderer – absolutely positioned rows inside spacer
     *************************************************************************/
    const renderRow = (v: VirtualItem) => {
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
              if (el) pageSizeRef.current.set(pg, pageSizeRef.current.get(pg) || { w: 0, h: 0 });
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
                type: "rectangle",
                annotationType: "Figure",
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
              onToolUsed?.();                // <-- call tool‐deselect
              clearDraft();
            }}
          >
            <Page
              pageNumber={pg}
              scale={zoom}
              onRenderSuccess={({ width, height }) => {
                if (!width || !height) return;
                const pw = width / zoom;
                const ph = height / zoom;
                const prev = pageSizeRef.current.get(pg);
                if (!prev || prev.w !== pw || prev.h !== ph) {
                  pageSizeRef.current.set(pg, { w: pw, h: ph });
                  // update dynamic average
                  sumHeightsRef.current += ph;
                  countRef.current += 1;
                  recalcOffsets();
                  setTick((t) => t + 1);
                }
              }}
            />

            {/* --- overlay & draft rectangle --- */}
            <AnnotationOverlay
              key={tick}
              annotations={annotations.filter((a) => a.page === pg)}
              selectedId={selectedId}
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

    /*************************************************************************
     * 7 Render wrapper + spacer (mandatory for stable scrollHeight)
     *************************************************************************/
    return (
      <div
        ref={scrollElRef}
        className="h-full overflow-y-auto"
        onClick={() => onSelectAnnotation(null)}>
        <div onClick={e => e.stopPropagation()}></div>
        <Document
          file={prefixStrapiUrl(pdfUrl)}
          onLoadSuccess={({ numPages }) => {
            setNumPages(numPages);
            onLoadSuccess({ numPages });
          }}
        >
          <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map(renderRow)}
          </div>
        </Document>
      </div>
    );
  }
);

export default PdfViewerWithAnnotations;
