/**
 * PDFThumbnail - Thin Wrapper (Tauri)
 * Provides getBlobUrl for Tauri asset protocol
 */

import { PDFThumbnail as PDFThumbnailUI } from "@deeprecall/ui/library";
import { convertFileSrc } from "@tauri-apps/api/core";

export function PDFThumbnail(
  props: Omit<React.ComponentProps<typeof PDFThumbnailUI>, "getBlobUrl">
) {
  return (
    <PDFThumbnailUI
      {...props}
      getBlobUrl={(sha256) =>
        convertFileSrc(
          `~/Documents/DeepRecall/blobs/${sha256.substring(0, 2)}/${sha256}`
        )
      }
    />
  );
}

export type { PDFThumbnailProps } from "@deeprecall/ui/library";
