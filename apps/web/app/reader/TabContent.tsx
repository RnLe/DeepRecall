/**
 * TabContent - Renders content based on active tab type
 * Handles different view types: pdf-viewer, annotation-editor, card-generator
 */

"use client";

import { useReaderUI } from "@/src/stores/reader-ui";
import { PDFViewer } from "./PDFViewer";
import { FileQuestion } from "lucide-react";

export function TabContent() {
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
  const blobUrl = `/api/blob/${activeTab.assetId}`;

  // Render based on tab type
  switch (activeTab.type) {
    case "pdf-viewer":
      return <PDFViewerTab assetId={activeTab.assetId} blobUrl={blobUrl} />;

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

/**
 * PDF Viewer tab content
 * Annotations are now loaded directly in PDFViewer from Dexie
 */
function PDFViewerTab({
  assetId,
  blobUrl,
}: {
  assetId: string;
  blobUrl: string;
}) {
  return (
    <PDFViewer
      key={assetId}
      source={blobUrl}
      sha256={assetId}
      className="h-full"
    />
  );
}
