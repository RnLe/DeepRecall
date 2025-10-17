/**
 * SimplePDFViewer - Minimal PDF viewer modal for quick viewing
 * No annotations, no special features - just clean PDF rendering
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { loadPDFDocument } from "@/src/utils/pdf";

interface SimplePDFViewerProps {
  sha256: string;
  title: string;
  onClose: () => void;
}

export function SimplePDFViewer({
  sha256,
  title,
  onClose,
}: SimplePDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load PDF
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    const loadPDF = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const pdfDoc = await loadPDFDocument(`/api/blob/${sha256}`);

        if (cancelled) {
          await pdfDoc.destroy();
          return;
        }

        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load PDF:", err);
        setError(err instanceof Error ? err.message : "Failed to load PDF");
        setIsLoading(false);
      }
    };

    loadPDF();

    return () => {
      cancelled = true;
      if (pdf) {
        pdf.destroy();
      }
    };
  }, [sha256]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-gray-100 truncate">
            {title}
          </h2>
          {numPages > 0 && (
            <span className="text-sm text-gray-400 flex-shrink-0">
              {numPages} page{numPages !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="p-2 rounded hover:bg-gray-700 text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-sm text-gray-400 min-w-[4rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={scale >= 3}
            className="p-2 rounded hover:bg-gray-700 text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={handleRotate}
            className="p-2 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors ml-2"
            title="Rotate"
          >
            <RotateCw size={18} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors ml-2"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-gray-850">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-400">Loading PDF...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <p className="text-red-400 mb-2">Failed to load PDF</p>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          </div>
        )}

        {pdf && !isLoading && (
          <div className="flex flex-col items-center gap-4 py-8">
            {Array.from({ length: numPages }, (_, i) => i + 1).map(
              (pageNum) => (
                <PDFPageRenderer
                  key={pageNum}
                  pdf={pdf}
                  pageNum={pageNum}
                  scale={scale}
                  rotation={rotation}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface PDFPageRendererProps {
  pdf: any;
  pageNum: number;
  scale: number;
  rotation: number;
}

function PDFPageRenderer({
  pdf,
  pageNum,
  scale,
  rotation,
}: PDFPageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    let cancelled = false;
    let currentRenderTask: any = null;

    const renderPage = async () => {
      try {
        setIsRendering(true);

        const page = await pdf.getPage(pageNum);
        if (cancelled) {
          page.cleanup();
          return;
        }

        const viewport = page.getViewport({ scale, rotation });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Cancel previous render if still running
        if (currentRenderTask) {
          currentRenderTask.cancel();
        }

        currentRenderTask = page.render({
          canvasContext: context,
          viewport: viewport,
        });

        await currentRenderTask.promise;

        if (!cancelled) {
          setIsRendering(false);
        }

        page.cleanup();
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error(`Failed to render page ${pageNum}:`, err);
          setIsRendering(false);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      if (currentRenderTask) {
        currentRenderTask.cancel();
      }
    };
  }, [pdf, pageNum, scale, rotation]);

  return (
    <div className="relative bg-white shadow-lg">
      <canvas ref={canvasRef} className="block" />
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent"></div>
        </div>
      )}
    </div>
  );
}
