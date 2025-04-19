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
import { Annotation, RectangleAnnotation } from "../../types/annotationTypes";
import { AnnotationMode } from "./annotationToolbar";
import { prefixStrapiUrl } from "@/app/helpers/getStrapiMedia";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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
  annotationMode: AnnotationMode;
  annotations: Annotation[];
  selectedId: string | null;
  onCreateAnnotation: (a: Annotation) => void;
  onSelectAnnotation: (a: Annotation) => void;
  onHoverAnnotation?: (a: Annotation | null) => void;
  renderTooltip?: (annotation: Annotation) => React.ReactNode;
  resolution: number;
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
      resolution,
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
        const baseH = pageSizes.get(pg)?.h ?? pageSizes.get(1)?.h ?? DEFAULT_PAGE_HEIGHT;
        // use scaled height so pages neither overlap nor leave growing gaps
        const scaledH = baseH * zoom;
        return scaledH + Math.max(1, Math.round(scaledH * 0.002));
      },
    });

    useEffect(() => {
      rowVirtualizer.measure();
    }, [zoom, pageSizes, rowVirtualizer]);

    useImperativeHandle(ref, () => ({
      scrollToPage: (p) =>
        rowVirtualizer.scrollToIndex(p - 1, { align: "start", behavior: "smooth" }),
      getPageSize: (p = 1) => {
        const size = pageSizes.get(p);
        return size ? { width: size.w, height: size.h } : null;
      },
      getCroppedImage: async (a) => {
        // load page at chosen resolution
        const loadingTask = pdfjs.getDocument(prefixStrapiUrl(pdfUrl));
        const pdfDoc = await loadingTask.promise;
        const pageObj = await pdfDoc.getPage(a.page);
        const viewport = pageObj.getViewport({ scale: resolution });

        // render full page at resolution
        const cvs = document.createElement("canvas");
        cvs.width = viewport.width;
        cvs.height = viewport.height;
        const ctx = cvs.getContext("2d")!;
        await pageObj.render({ canvasContext: ctx, viewport }).promise;

        // crop out the annotation rect
        const sx = a.x * viewport.width;
        const sy = a.y * viewport.height;
        const sw = a.width * viewport.width;
        const sh = a.height * viewport.height;
        const crop = document.createElement("canvas");
        crop.width = sw;
        crop.height = sh;
        const cctx = crop.getContext("2d")!;
        cctx.drawImage(cvs, sx, sy, sw, sh, 0, 0, sw, sh);

        return new Promise<Blob>((res) =>
          crop.toBlob((b) => res(b!), "image/png")
        );
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

    const renderRow = (vRow: any) => {
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
            data-index={vRow.index}
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
                  const c = new Map(m);
                  // store base (unscaled) dimensions so fitWidth/fitHeight works correctly
                  c.set(pg, { w: width! / zoom, h: height! / zoom });
                  return c;
                });
                const node = pageRefs.current.get(pg);
                if (node) rowVirtualizer.measureElement(node);
              }}
            />

            <AnnotationOverlay
              annotations={annotations.filter((x) => x.page === pg)}
              selectedId={selectedId}
              pageWidth={(pageSizes.get(pg)?.w ?? 0) * zoom}
              pageHeight={(pageSizes.get(pg)?.h ?? 0) * zoom}
              onSelectAnnotation={onSelectAnnotation}
              onHoverAnnotation={onHoverAnnotation}
              renderTooltip={renderTooltip}
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
      <div ref={scrollParentRef} className="h-full overflow-y-auto">
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
          <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map(renderRow)}
          </div>
        </Document>
      </div>
    );
  }
);

export default PdfViewerWithAnnotations;