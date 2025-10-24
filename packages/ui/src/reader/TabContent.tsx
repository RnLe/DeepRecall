/**
 * TabContent - Renders content based on active tab type
 * Handles different view types: pdf-viewer, annotation-editor, card-generator
 *
 * Platform-agnostic component using @deeprecall/data stores
 */

"use client";

import { useReaderUI } from "@deeprecall/data";
import { FileQuestion } from "lucide-react";
import type { ComponentType } from "react";

export interface PDFViewerComponentProps {
  source: string;
  sha256: string;
  className?: string;
}

export interface TabContentOperations {
  /**
   * Platform-specific PDF viewer component
   * @example Web: PDFViewer from apps/web/app/reader/PDFViewer.tsx
   * @example Desktop: Tauri-specific PDF viewer
   * @example Mobile: Native PDF viewer wrapper
   */
  PDFViewerComponent: ComponentType<PDFViewerComponentProps>;

  /**
   * Generate blob URL from asset ID (platform-specific)
   * @example Web: (assetId) => `/api/blob/${assetId}`
   * @example Desktop: (assetId) => `file:///.../blobs/${assetId}`
   * @example Mobile: (assetId) => Capacitor.convertFileSrc(...)
   */
  getBlobUrl: (assetId: string) => string;
}

export interface TabContentProps extends TabContentOperations {}

export function TabContent({
  PDFViewerComponent,
  getBlobUrl,
}: TabContentProps) {
  const { getActiveTab } = useReaderUI();
  const activeTab = getActiveTab();

  if (!activeTab) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500">
        <FileQuestion className="w-16 h-16 mb-4 text-gray-600" />
        <p className="text-lg font-medium mb-2 text-gray-400">No file open</p>
        <p className="text-sm text-gray-500">
          Select a PDF from the sidebar to get started
        </p>
      </div>
    );
  }

  // Generate blob URL from asset ID (SHA-256)
  const blobUrl = getBlobUrl(activeTab.assetId);

  // Render based on tab type
  switch (activeTab.type) {
    case "pdf-viewer":
      return (
        <PDFViewerComponent
          key={activeTab.assetId}
          source={blobUrl}
          sha256={activeTab.assetId}
          className="h-full"
        />
      );

    case "annotation-editor":
      // TODO: Implement annotation editor view
      return (
        <div className="h-full flex items-center justify-center">
          <p className="text-gray-500">Annotation editor (coming soon)</p>
        </div>
      );

    case "card-generator":
      // TODO: Implement card generator view
      return (
        <div className="h-full flex items-center justify-center">
          <p className="text-gray-500">Card generator (coming soon)</p>
        </div>
      );

    default:
      return (
        <div className="h-full flex items-center justify-center">
          <p className="text-gray-500">Unknown tab type: {activeTab.type}</p>
        </div>
      );
  }
}
