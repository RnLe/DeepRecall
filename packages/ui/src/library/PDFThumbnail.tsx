/**
 * PDFThumbnail - Lightweight first-page PDF thumbnail renderer
 * Optimized for work cards - minimal overhead, first page only
 *
 * Uses usePDF from @deeprecall/pdf directly - only needs getBlobUrl wrapper!
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { usePDF } from "@deeprecall/pdf";
import { logger } from "@deeprecall/telemetry";

export interface PDFThumbnailProps {
  /** SHA-256 hash of the PDF to display */
  sha256: string;
  /** Function to get blob URL from SHA-256 */
  getBlobUrl: (sha256: string) => string;
  /** CSS class for the container */
  className?: string;
  /** Width in pixels (height will be calculated from aspect ratio) */
  width?: number;
  /** Height in pixels (width will be calculated from aspect ratio) */
  height?: number;
}

/**
 * Renders the first page of a PDF as a thumbnail
 * Uses canvas for efficient rendering with minimal memory footprint
 */
export function PDFThumbnail({
  sha256,
  getBlobUrl,
  className = "",
  width,
  height,
}: PDFThumbnailProps) {
  const { pdf, isLoading, error } = usePDF(getBlobUrl(sha256));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    let cancelled = false;

    const renderThumbnail = async () => {
      try {
        // Get first page
        const page = await pdf.getPage(1);
        if (cancelled) return;

        // Get original viewport
        const originalViewport = page.getViewport({ scale: 1 });

        // Calculate scale to fit target dimensions
        let scale = 1;
        if (width) {
          scale = width / originalViewport.width;
        } else if (height) {
          scale = height / originalViewport.height;
        }

        // Get scaled viewport
        const viewport = page.getViewport({ scale });

        // Set canvas dimensions
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Render page to canvas
        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        // Set dimensions after successful render to show the canvas
        setDimensions({
          width: viewport.width,
          height: viewport.height,
        });

        // Clean up page
        page.cleanup();
      } catch (err) {
        logger.error("ui", "Error rendering PDF thumbnail", {
          error: err,
          sha256,
        });
      }
    };

    renderThumbnail();

    return () => {
      cancelled = true;
    };
  }, [pdf, width, height]);

  // Always render the canvas, but show/hide based on state
  return (
    <div className={`flex items-center justify-center relative ${className}`}>
      {/* Canvas - hidden until rendered */}
      <canvas
        ref={canvasRef}
        className="bg-white"
        style={{
          display: dimensions ? "block" : "none",
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      />

      {/* Loading/Error state - shown when no dimensions yet */}
      {!dimensions && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-800/50">
          {error ? (
            <BookOpen className="w-6 h-6 text-neutral-600" />
          ) : (
            <div className="animate-pulse">
              <BookOpen className="w-6 h-6 text-neutral-600" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
