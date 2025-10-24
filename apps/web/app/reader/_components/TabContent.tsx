/**
 * TabContent - Next.js wrapper for platform-agnostic TabContent
 * Injects PDFViewer component and blob URL generator
 */

"use client";

import { TabContent as TabContentUI } from "@deeprecall/ui";
import { PDFViewer } from "../PDFViewer";

export function TabContent() {
  return (
    <TabContentUI
      PDFViewerComponent={PDFViewer}
      getBlobUrl={(assetId) => `/api/blob/${assetId}`}
    />
  );
}
