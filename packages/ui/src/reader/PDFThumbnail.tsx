/**
 * PDFThumbnail - Lightweight thumbnail component
 * Renders a single page at low resolution for previews, sidebars, etc.
 *
 * Platform-agnostic component using @deeprecall/pdf
 */

"use client";

import { usePDF } from "@deeprecall/pdf";
import { PDFPage } from "./PDFPage";

export interface PDFThumbnailProps {
  source: string | Uint8Array | ArrayBuffer;
  pageNumber?: number;
  maxWidth?: number;
  className?: string;
  onClick?: () => void;
}

/**
 * Optimized thumbnail renderer for PDF previews
 * Automatically scales down for performance
 */
export function PDFThumbnail({
  source,
  pageNumber = 1,
  maxWidth = 150,
  className = "",
  onClick,
}: PDFThumbnailProps) {
  const { pdf, isLoading, error } = usePDF(source);

  // Calculate low scale for thumbnail (assuming ~600px page width at scale 1)
  const thumbnailScale = maxWidth / 600;

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 border ${className}`}
        style={{ width: maxWidth, height: maxWidth * 1.4 }}
      >
        <div className="text-xs text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !pdf) {
    return (
      <div
        className={`flex items-center justify-center bg-red-50 border border-red-300 ${className}`}
        style={{ width: maxWidth, height: maxWidth * 1.4 }}
      >
        <div className="text-xs text-red-600">Error</div>
      </div>
    );
  }

  return (
    <div
      className={`pdf-thumbnail cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all ${className}`}
      onClick={onClick}
      style={{ width: maxWidth }}
    >
      <PDFPage
        pdf={pdf}
        pageNumber={pageNumber}
        scale={thumbnailScale}
        docId={typeof source === "string" ? source : "thumbnail"}
      />
    </div>
  );
}
