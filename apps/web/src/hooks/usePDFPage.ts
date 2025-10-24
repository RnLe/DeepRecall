/**
 * usePDFPage hook - Manages individual PDF page rendering with caching
 */

import { useEffect, useState, useRef } from "react";
import {
  PDFDocumentProxy,
  PDFPageProxy,
  renderPageToCanvas,
} from "../utils/pdf";
import { globalPageCache } from "@deeprecall/ui/utils";

export interface UsePDFPageResult {
  canvas: HTMLCanvasElement | null;
  isLoading: boolean;
  error: Error | null;
  pageInfo: {
    width: number;
    height: number;
  } | null;
}

/**
 * Render a PDF page to a canvas with caching
 * @param pdf PDF document proxy
 * @param pageNumber Page number (1-indexed)
 * @param scale Rendering scale
 * @param docId Optional document ID for cache keying
 * @returns Rendered canvas and state
 */
export function usePDFPage(
  pdf: PDFDocumentProxy | null,
  pageNumber: number,
  scale: number = 1.5,
  docId?: string
): UsePDFPageResult {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [pageInfo, setPageInfo] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const renderTaskRef = useRef<number>(0);
  const effectiveDocId = docId || "default";

  useEffect(() => {
    if (!pdf || pageNumber < 1 || pageNumber > pdf.numPages) {
      setCanvas(null);
      setPageInfo(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const taskId = ++renderTaskRef.current;

    // Check cache first
    const cached = globalPageCache.getPage(effectiveDocId, pageNumber, scale);
    if (cached) {
      setCanvas(cached);
      setPageInfo({ width: cached.width, height: cached.height });
      setIsLoading(false);
      setError(null);
      return;
    }

    // Not cached, render
    setIsLoading(true);
    setError(null);

    let page: PDFPageProxy | null = null;

    pdf
      .getPage(pageNumber)
      .then((p) => {
        page = p;
        if (taskId !== renderTaskRef.current) return; // Task superseded

        // Get viewport to determine canvas size
        const viewport = p.getViewport({ scale });

        // Create canvas
        const newCanvas = document.createElement("canvas");
        newCanvas.width = viewport.width;
        newCanvas.height = viewport.height;

        setPageInfo({ width: viewport.width, height: viewport.height });

        // Render
        return renderPageToCanvas(p, newCanvas, scale).then(() => newCanvas);
      })
      .then((renderedCanvas) => {
        if (!renderedCanvas || taskId !== renderTaskRef.current) return;

        // Cache the rendered canvas
        globalPageCache.setPage(
          effectiveDocId,
          pageNumber,
          scale,
          renderedCanvas
        );

        setCanvas(renderedCanvas);
        setIsLoading(false);
      })
      .catch((err) => {
        if (taskId === renderTaskRef.current) {
          setError(err);
          setIsLoading(false);
          setCanvas(null);
        }
      })
      .finally(() => {
        // Cleanup page
        if (page && taskId === renderTaskRef.current) {
          page.cleanup();
        }
      });

    // No cleanup needed - cache persists across component lifecycles
  }, [pdf, pageNumber, scale, effectiveDocId]);

  return {
    canvas,
    isLoading,
    error,
    pageInfo,
  };
}
