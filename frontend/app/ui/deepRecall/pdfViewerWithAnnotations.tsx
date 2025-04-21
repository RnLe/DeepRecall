// src/components/pdfViewer/pdfViewerWithAnnotations.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Enhanced PDF viewer with virtualization, smooth jumps, accurate offsets,
// and in‑place annotation creation.
//
//  MAIN RESPONSIBILITIES
//  • Render and virtualize PDF pages with @tanstack/react‑virtual
//  • Provide imperative helpers (scrollToPage, getPageSize, getCroppedImage)
//  • Keep scroll position ↔ page state in sync without feedback loops
//  • Support text‑highlight and rectangle annotations with live overlays
//  • React gracefully to zoom changes (debounced re‑measurement)
//
//  *** No public API, prop names, or runtime behaviour has been changed ***
//
//  To quickly locate code, jump to these high‑level sections:
//
//    1. Imports & worker configuration
//    2. Public types & constants
//    3. Component ── setup (refs, state, virtualizer)
//    4. Component ── helpers  (offset maths, debounced measure)
//    5. Component ── imperative handle
//    6. Component ── scroll / effect wiring
//    7. Annotation helpers (text & rectangle)
//    8. Row renderer  (single virtual page + overlay)
//    9. Render wrapper
//   10. Export
// ─────────────────────────────────────────────────────────────────────────────


/* ════════════════════════════════════════════════════════════════════════════
 * 1 Imports & PDF.js worker configuration
 *    – external libs      (React, react‑pdf, react‑virtual, lodash)
 *    – internal components(types, helpers, overlays)
 *    – worker setup MUST be top‑level (PDF.js requirement)
 *   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
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

// Configure PDF.js to load its worker via ESM URL (required in modern bundlers)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();



/* ════════════════════════════════════════════════════════════════════════════
 * 2 Public types & constants
 *   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export interface PdfViewerHandle {
  /** Programmatically scroll so that page *page* is the first visible page */
  scrollToPage(page: number): void;
  /** Obtain the *un‑scaled* intrinsic size of a page (in CSS pixels) */
  getPageSize(page?: number): { width: number; height: number } | null;
  /** Rasterise an annotation’s rectangle to a PNG blob at the given DPI */
  getCroppedImage(annotation: RectangleAnnotation): Promise<Blob>;
}

interface Props {
  pdfUrl: string;
  zoom: number;                                   // global scale factor (1 = 100 %)
  pageNumber: number;                             // *unused* but left intact
  onLoadSuccess: (info: { numPages: number }) => void;
  onVisiblePageChange?: (page: number) => void;   // emits first fully‑visible page
  annotationMode: AnnotationMode;
  annotations: Annotation[];
  selectedId: string | null;
  onCreateAnnotation: (a: Annotation) => void;
  onSelectAnnotation: (a: Annotation | null) => void;
  onHoverAnnotation?: (a: Annotation | null) => void;
  renderTooltip?: (annotation: Annotation) => React.ReactNode;
  resolution: number;                             // DPI for cropped images
  colorMap: Record<AnnotationType, string>;
  onToolUsed?: () => void;                        // → parent clears active tool
}

/** Fallback height (A4 @ 72 dpi) used until the real page height is known */
const DEFAULT_PAGE_HEIGHT = 842;



/* ════════════════════════════════════════════════════════════════════════════
 * 3 Component definition ─ setup (refs, state, virtualizer)
 *    All mutable objects that must survive re‑renders live in refs.
 *   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
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
    // ───── Persistent refs ─────
    const scrollElRef        = useRef<HTMLDivElement>(null);     // scrolling div
    const pageSizeRef        = useRef(new Map<number, { w: number; h: number }>());
    const lastPageRef        = useRef(1);                        // last emitted page
    const isProgrammaticRef  = useRef(false);                    // guard for scroll loop
    const offsetsRef         = useRef<number[]>([]);             // cumulative page tops
    const sumHeightsRef      = useRef(0);                        // running mean of heights
    const countRef           = useRef(0);

    // ───── Local state ─────
    const [numPages, setNumPages] = useState(0);                 // total pages
    const [tick, setTick]         = useState(0);                 // forces overlay refresh

    // ───── Virtualizer initial options (kept stable in optionsRef) ─────
    const initialOverscan = 6;
    const optionsRef = useRef({
      count: numPages,
      getScrollElement: () => scrollElRef.current!,
      estimateSize: () => DEFAULT_PAGE_HEIGHT * zoom,
      overscan: initialOverscan,
    });
    const rowVirtualizer = useVirtualizer(optionsRef.current);



/* ════════════════════════════════════════════════════════════════════════════
 * 4 Helpers (cumulative offsets & debounced re‑measure)
 *   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    /** Recompute *page top* offsets whenever page size / zoom changes */
    const recalcOffsets = () => {
      const arr: number[] = [];
      let acc = 0;
      for (let i = 1; i <= numPages; i++) {
        arr[i - 1] = acc;
        const intrinsic = pageSizeRef.current.get(i);
        const h = intrinsic ? intrinsic.h * zoom : DEFAULT_PAGE_HEIGHT * zoom;
        acc += h;
      }
      offsetsRef.current = arr;
    };

    /** Re‑measure virtual row heights after zoom (debounced – avoids thrash) */
    const debouncedMeasure = useMemo(
      () =>
        debounce(() => {
          rowVirtualizer.measure();   // trigger react‑virtual re‑calc
          recalcOffsets();            // keep handmade offsets in lockstep
        }, 50),
      [rowVirtualizer]
    );

    useEffect(() => debouncedMeasure(), [zoom, debouncedMeasure]);



/* ════════════════════════════════════════════════════════════════════════════
 * 5 Imperative handle  (public methods exposed via ref)
 *    All three helpers use current refs only – never trigger React renders.
 *   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    useImperativeHandle(ref, () => ({
      scrollToPage: (targetPage: number) => {
        const distance = Math.abs(targetPage - lastPageRef.current);

        // (a) Expand overscan for very large jumps to avoid blank screen
        if (distance > 6) {
          rowVirtualizer.setOptions({
            ...rowVirtualizer.options,
            overscan: distance + 2,
          });
        }

        // (b) Scroll – guard against onVisiblePageChange feedback
        const offset =
          offsetsRef.current[targetPage - 1] ??
          (targetPage - 1) * DEFAULT_PAGE_HEIGHT * zoom;

        isProgrammaticRef.current = true;
        scrollElRef.current!.scrollTop = offset;

        // (c) Restore default overscan after scroll settles
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

      async getCroppedImage(a: RectangleAnnotation) {
        const pdf      = await pdfjs.getDocument(prefixStrapiUrl(pdfUrl)).promise;
        const pgObj    = await pdf.getPage(a.page);
        const viewport = pgObj.getViewport({ scale: resolution });

        // Render full‑page bitmap
        const canvas   = document.createElement("canvas");
        canvas.width   = viewport.width;
        canvas.height  = viewport.height;
        await pgObj.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;

        // Crop annotation rectangle
        const crop   = document.createElement("canvas");
        crop.width   = a.width  * viewport.width;
        crop.height  = a.height * viewport.height;
        crop.getContext("2d")!.drawImage(
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

        return new Promise<Blob>((res) => crop.toBlob((b) => res(b!), "image/png"));
      },
    }));



/* ════════════════════════════════════════════════════════════════════════════
 * 6 Effects – keep scroll↔page state & virtualizer config in sync
 *    ── (A) Emit visible page on user scroll
 *    ── (B) Sync virtualizer when numPages / zoom changes
 *   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    // (A) User‑driven scroll → onVisiblePageChange (throttled, guarded)
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
      handler();                           // emit immediately on mount
      return () => el.removeEventListener("scroll", handler);
    }, [onVisiblePageChange, rowVirtualizer]);

    // (B‑1) When total page count arrives → update virtualizer
    useEffect(() => {
      optionsRef.current.count = numPages;
      rowVirtualizer.setOptions({ ...rowVirtualizer.options, count: numPages });
      recalcOffsets();
      rowVirtualizer.measure();
    }, [numPages, rowVirtualizer]);

    // (B‑2) When zoom changes → update estimateSize & measure
    useEffect(() => {
      rowVirtualizer.setOptions({
        ...rowVirtualizer.options,
        estimateSize: () => DEFAULT_PAGE_HEIGHT * zoom,
      });
      debouncedMeasure();
    }, [zoom]);



/* ════════════════════════════════════════════════════════════════════════════
 * 7 Annotation helpers  (text selection & rectangle drag)
 *   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    // Draft rectangle (only live while mouse is down)
    const [draft, setDraft] = useState<
      | null
      | { page: number; x0: number; y0: number; x1: number; y1: number }
    >(null);
    const clearDraft = () => setDraft(null);

    /** Handle finished text selection (creates highlight annotation) */
    const handleTextSelect = useCallback(() => {
      if (annotationMode !== "text") return;

      const sel = document.getSelection();
      if (!sel || sel.isCollapsed) return;

      const range = sel.getRangeAt(0);
      const pgEl  = range.startContainer.parentElement?.closest("[data-page-number]");
      if (!pgEl) return;

      const pg    = Number(pgEl.getAttribute("data-page-number"));
      const rect  = range.getBoundingClientRect();
      const pr    = pgEl.getBoundingClientRect();

      onCreateAnnotation({
        type: "text",
        annotationType: "Text Highlight",
        highlightedText: sel.toString(),
        page: pg,
        x: (rect.left - pr.left) / pr.width,
        y: (rect.top  - pr.top)  / pr.height,
        width:  rect.width  / pr.width,
        height: rect.height / pr.height,
        literatureId: "",
        pdfId: "",
        annotation_tags: [],
        annotation_groups: [],
      });

      onToolUsed?.();   // parent may switch back to selection tool
      sel.removeAllRanges();
    }, [annotationMode, onCreateAnnotation, onToolUsed]);

    useEffect(() => {
      document.addEventListener("mouseup", handleTextSelect);
      return () => document.removeEventListener("mouseup", handleTextSelect);
    }, [handleTextSelect]);



/* ════════════════════════════════════════════════════════════════════════════
 * 8 Row renderer  (virtualised page with overlays & draft rectangle)
 *    A *row* is absolutely positioned inside a single big spacer div.
 *   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
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
            /*  Track intrinsic page size once rendered; used for precise
                offset calculations and rectangle annotation geometry       */
            ref={(el) => {
              if (el)
                pageSizeRef.current.set(
                  pg,
                  pageSizeRef.current.get(pg) || { w: 0, h: 0 }
                );
            }}
            style={{ display: "inline-block", position: "relative" }}
            /* ───────── Rectangle‑annotation mouse handlers ───────── */
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

              const x0     = Math.min(draft.x0, draft.x1);
              const y0     = Math.min(draft.y0, draft.y1);
              const width  = Math.abs(draft.x1 - draft.x0);
              const height = Math.abs(draft.y1 - draft.y0);

              onCreateAnnotation({
                type: "rectangle",
                annotationType: "Figure",
                page: draft.page,
                x: x0 / dispW,
                y: y0 / dispH,
                width:  width  / dispW,
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
            {/* ─────────────────────── PDF page canvas ─────────────────────── */}
            <Page
              pageNumber={pg}
              scale={zoom}
              onRenderSuccess={({ width, height }) => {
                if (!width || !height) return;

                // Store intrinsic page dimensions (un‑scaled)
                const pw = width  / zoom;
                const ph = height / zoom;
                const prev = pageSizeRef.current.get(pg);

                if (!prev || prev.w !== pw || prev.h !== ph) {
                  pageSizeRef.current.set(pg, { w: pw, h: ph });

                  // Track running average for debug / future heuristics
                  sumHeightsRef.current += ph;
                  countRef.current      += 1;

                  recalcOffsets();            // update page‑top cache
                  setTick((t) => t + 1);      // re‑render overlay
                }
              }}
            />

            {/* ─────────────────────── Annotation overlay ──────────────────── */}
            <AnnotationOverlay
              /* key={tick} forces remount when page geometry changes */
              key={tick}
              annotations={annotations.filter((a) => a.page === pg)}
              selectedId={selectedId}
              pageWidth ={(pageSizeRef.current.get(pg)?.w ?? 0) * zoom}
              pageHeight={(pageSizeRef.current.get(pg)?.h ?? 0) * zoom}
              onSelectAnnotation={onSelectAnnotation}
              onHoverAnnotation={onHoverAnnotation}
              renderTooltip={renderTooltip}
              colorMap={colorMap}
            />

            {/* ─────────────────────── Draft rectangle ─────────────────────── */}
            {draft?.page === pg && (
              <div
                style={{
                  position: "absolute",
                  left  : Math.min(draft.x0, draft.x1),
                  top   : Math.min(draft.y0, draft.y1),
                  width : Math.abs(draft.x1 - draft.x0),
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



/* ════════════════════════════════════════════════════════════════════════════
 * 9 Render wrapper  (scroll container + spacer div)
 *    A single enormous spacer div guarantees stable scrollHeight, and the
 *    absolutely‑positioned rows are placed inside.
 *   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    return (
      <div
        ref={scrollElRef}
        className="h-full overflow-y-auto"
        onClick={() => onSelectAnnotation(null)}
      >
        {/* prevent click‑through on empty space */}
        <div onClick={(e) => e.stopPropagation()}></div>

        <Document
          file={prefixStrapiUrl(pdfUrl)}
          onLoadSuccess={({ numPages }) => {
            setNumPages(numPages);
            onLoadSuccess({ numPages });
          }}
        >
          <div
            /* Spacer div height must equal *sum of all row heights* so that
               native scrolling works. react‑virtual updates via measure(). */
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



/* ════════════════════════════════════════════════════════════════════════════
 * 10 Export
 *   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default PdfViewerWithAnnotations;
