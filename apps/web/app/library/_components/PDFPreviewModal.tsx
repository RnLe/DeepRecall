/**
 * PDFPreviewModal - Thin Wrapper
 * Provides getBlobUrl for Next.js blob API routing
 */

"use client";

import { PDFPreviewModal as PDFPreviewModalUI } from "@deeprecall/ui/library";

export function PDFPreviewModal(
  props: Omit<React.ComponentProps<typeof PDFPreviewModalUI>, "getBlobUrl">
) {
  return (
    <PDFPreviewModalUI
      {...props}
      getBlobUrl={(sha256) => `/api/blob/${sha256}`}
    />
  );
}

export type { PDFPreviewModalProps } from "@deeprecall/ui/library";
