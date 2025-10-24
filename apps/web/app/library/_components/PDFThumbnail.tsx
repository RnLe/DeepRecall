/**
 * PDFThumbnail - Thin Wrapper
 * Provides getBlobUrl for Next.js blob API routing
 */

"use client";

import { PDFThumbnail as PDFThumbnailUI } from "@deeprecall/ui/library";

export function PDFThumbnail(
  props: Omit<React.ComponentProps<typeof PDFThumbnailUI>, "getBlobUrl">
) {
  return (
    <PDFThumbnailUI {...props} getBlobUrl={(sha256) => `/api/blob/${sha256}`} />
  );
}

export type { PDFThumbnailProps } from "@deeprecall/ui/library";
