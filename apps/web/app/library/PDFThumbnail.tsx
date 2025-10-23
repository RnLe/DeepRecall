/**
 * PDFThumbnail - Next.js Wrapper
 * Wraps the platform-agnostic PDFThumbnail with Next.js-specific dependencies
 */

"use client";

import { PDFThumbnail as PDFThumbnailUI } from "@deeprecall/ui";
import { usePDF } from "@/src/hooks/usePDF";

interface PDFThumbnailProps {
  sha256: string;
  className?: string;
  width?: number;
  height?: number;
}

export function PDFThumbnail(props: PDFThumbnailProps) {
  return (
    <PDFThumbnailUI
      {...props}
      getBlobUrl={(sha256) => `/api/blob/${sha256}`}
      usePDF={usePDF}
    />
  );
}
