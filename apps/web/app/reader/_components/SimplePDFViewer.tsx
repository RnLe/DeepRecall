/**
 * Web platform wrapper for SimplePDFViewer
 * Implements web-specific blob URL generation
 */

"use client";

import {
  SimplePDFViewer as SimplePDFViewerUI,
  SimplePDFViewerProps as BaseProps,
} from "@deeprecall/ui/components";

/** Web-specific props (getBlobUrl auto-injected) */
export type SimplePDFViewerProps = Omit<BaseProps, "getBlobUrl">;

/**
 * Web-specific SimplePDFViewer with blob URL helper
 */
export function SimplePDFViewer(props: SimplePDFViewerProps) {
  const getBlobUrl = (sha256: string) => `/api/blob/${sha256}`;

  return <SimplePDFViewerUI {...props} getBlobUrl={getBlobUrl} />;
}
