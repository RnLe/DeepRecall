/**
 * PDFTextLayer - Renders selectable text layer over PDF canvas using PDF.js native utilities
 * Provides text selection, links, and proper font rendering
 */

"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFPageProxy } from "@/src/utils/pdf";

interface PDFTextLayerProps {
  page: PDFPageProxy;
  scale: number;
  viewport: any;
  /** Current annotation tool - used to disable text selection during rectangle drawing */
  tool?: "pan" | "rectangle" | "highlight" | "note" | "kind-rectangle";
}

/**
 * Renders text layer and annotation layer (links) over the PDF canvas
 * Uses PDF.js renderTextLayer for production-ready text selection
 */
export function PDFTextLayer({
  page,
  scale,
  viewport,
  tool,
}: PDFTextLayerProps) {
  const textContainerRef = useRef<HTMLDivElement>(null);
  const annotationContainerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let textLayerBuilder: any | null = null;

    const renderLayers = async () => {
      if (!textContainerRef.current || !annotationContainerRef.current) return;

      const textContainer = textContainerRef.current;
      const annotationContainer = annotationContainerRef.current;

      // Clear previous content
      textContainer.innerHTML = "";
      annotationContainer.innerHTML = "";
      setIsReady(false);

      try {
        if (!(globalThis as any).pdfjsLib) {
          const lib = (await import("pdfjs-dist")) as any;
          if (cancelled) return;
          lib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
          (globalThis as any).pdfjsLib = lib;
        }

        const pdfViewer = (await import(
          "pdfjs-dist/web/pdf_viewer.mjs"
        )) as any;
        if (cancelled) return;

        // Build text layer using official TextLayerBuilder for robust selection
        textLayerBuilder = new (pdfViewer as any).TextLayerBuilder({
          pdfPage: page as any,
        });

        const textLayerDiv: HTMLDivElement = textLayerBuilder.div;
        textLayerDiv.classList.add("pdf-text-layer");
        textLayerDiv.style.zIndex = "5";

        // Set CSS variables for accurate font scaling (PDF.js expects these)
        textLayerDiv.style.setProperty("--scale-factor", String(scale));
        textLayerDiv.style.setProperty("--user-unit", "1");

        textContainer.appendChild(textLayerDiv);

        try {
          await textLayerBuilder.render({ viewport });
        } catch (error: any) {
          // Suppress expected cancellation errors during fast scrolling
          if (
            error?.name === "AbortException" ||
            error?.message?.includes("cancelled")
          ) {
            return;
          }
          throw error; // Re-throw unexpected errors
        }
        if (cancelled) return;

        // Render annotation layer (links) manually with proper transforms
        const annotations = await (page as any).getAnnotations();
        if (cancelled) return;

        (annotations as any[]).forEach((annotation: any) => {
          if (annotation.subtype !== "Link") return;

          const rect = annotation.rect as [number, number, number, number];

          const linkDiv = document.createElement("a");
          linkDiv.className = "pdf-link";

          // Convert PDF rect to viewport pixel rectangle
          const [x1v, y1v, x2v, y2v] =
            viewport.convertToViewportRectangle(rect);
          const left = Math.min(x1v, x2v);
          const top = Math.min(y1v, y2v);
          const width = Math.abs(x2v - x1v);
          const height = Math.abs(y2v - y1v);

          linkDiv.style.position = "absolute";
          linkDiv.style.left = `${left}px`;
          linkDiv.style.top = `${top}px`;
          linkDiv.style.width = `${width}px`;
          linkDiv.style.height = `${height}px`;
          linkDiv.style.pointerEvents = "auto";

          if (annotation.url) {
            linkDiv.href = annotation.url;
            linkDiv.target = "_blank";
            linkDiv.rel = "noopener noreferrer";
            linkDiv.title = annotation.url;
          } else if (annotation.dest) {
            linkDiv.href = "#";
            linkDiv.dataset.dest = JSON.stringify(annotation.dest);
            linkDiv.title = "Go to page";
            linkDiv.onclick = (e) => {
              e.preventDefault();
              // TODO: Wire up internal navigation via annotationUI.navigateToPage
            };
          }

          annotationContainer.appendChild(linkDiv);
        });

        setIsReady(true);
      } catch (error) {
        console.error("Failed to render text/annotation layers:", error);
      }
    };

    renderLayers();

    return () => {
      cancelled = true;
      textLayerBuilder?.cancel?.();
    };
  }, [page, viewport, scale]);

  return (
    <>
      {/* Text layer for selection */}
      <div
        ref={textContainerRef}
        className="pdf-text-layer-container absolute inset-0 overflow-hidden"
        style={{
          opacity: isReady ? 1 : 0,
          lineHeight: 1,
          zIndex: 5,
        }}
      />

      {/* Annotation layer for links */}
      <div
        ref={annotationContainerRef}
        className="pdf-annotation-layer absolute inset-0 overflow-hidden"
        style={{
          pointerEvents: "none",
          zIndex: 30,
        }}
      />
    </>
  );
}
