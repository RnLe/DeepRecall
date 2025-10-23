/**
 * PDFPreviewModal - Next.js Wrapper
 * Wraps the platform-agnostic PDFPreviewModal with Next.js-specific dependencies
 */

"use client";

import { PDFPreviewModal as PDFPreviewModalUI } from "@deeprecall/ui";
import { PDFPreview } from "@/app/reader/PDFPreview";

interface PDFPreviewModalProps {
  sha256: string | null;
  title?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PDFPreviewModal(props: PDFPreviewModalProps) {
  return (
    <PDFPreviewModalUI
      {...props}
      getBlobUrl={(sha256) => `/api/blob/${sha256}`}
      PDFPreview={PDFPreview}
    />
  );
}
