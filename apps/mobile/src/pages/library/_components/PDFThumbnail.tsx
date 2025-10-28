/**
 * PDFThumbnail Wrapper (Capacitor Mobile)
 * Provides getBlobUrl for Capacitor file:// URLs
 */

"use client";

import { PDFThumbnail as PDFThumbnailUI } from "@deeprecall/ui/library";
import { useCapacitorBlobStorage } from "../../../hooks/useBlobStorage";

export function PDFThumbnail(
  props: Omit<React.ComponentProps<typeof PDFThumbnailUI>, "getBlobUrl">
) {
  const cas = useCapacitorBlobStorage();

  return (
    <PDFThumbnailUI {...props} getBlobUrl={(sha256) => cas.getUrl(sha256)} />
  );
}

export type { PDFThumbnailProps } from "@deeprecall/ui/library";
