/**
 * PDFPreviewModal Wrapper (Capacitor Mobile)
 * Provides getBlobUrl for Capacitor file:// URLs
 */

"use client";

import { PDFPreviewModal as PDFPreviewModalUI } from "@deeprecall/ui/library";
import { useCapacitorBlobStorage } from "../../../hooks/useBlobStorage";

export function PDFPreviewModal(
  props: Omit<React.ComponentProps<typeof PDFPreviewModalUI>, "getBlobUrl">
) {
  const cas = useCapacitorBlobStorage();

  return (
    <PDFPreviewModalUI {...props} getBlobUrl={(sha256) => cas.getUrl(sha256)} />
  );
}

export type { PDFPreviewModalProps } from "@deeprecall/ui/library";
