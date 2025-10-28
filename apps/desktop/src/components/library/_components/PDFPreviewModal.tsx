/**
 * PDFPreviewModal - Thin Wrapper (Tauri)
 * Provides getBlobUrl for Tauri asset protocol
 */

import { PDFPreviewModal as PDFPreviewModalUI } from "@deeprecall/ui/library";
import { convertFileSrc } from "@tauri-apps/api/core";

export function PDFPreviewModal(
  props: Omit<React.ComponentProps<typeof PDFPreviewModalUI>, "getBlobUrl">
) {
  return (
    <PDFPreviewModalUI
      {...props}
      getBlobUrl={(sha256) =>
        convertFileSrc(
          `~/Documents/DeepRecall/blobs/${sha256.substring(0, 2)}/${sha256}`
        )
      }
    />
  );
}

export type { PDFPreviewModalProps } from "@deeprecall/ui/library";
