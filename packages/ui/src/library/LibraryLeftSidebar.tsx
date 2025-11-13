/**
 * LibraryLeftSidebar Component (Platform-agnostic)
 * Container for new files (inbox) and unlinked assets sections
 * Uses Electric hooks and imports components directly
 */

import React, { useState } from "react";
import type { Asset } from "@deeprecall/core";
import { UnlinkedAssetsList } from "./UnlinkedAssetsList";
import { SimplePDFViewer } from "../components/SimplePDFViewer";
import { logger } from "@deeprecall/telemetry";

// Platform-specific operations interface (minimal)
export interface LibraryLeftSidebarOperations {
  // Asset/blob operations
  fetchBlobContent: (sha256: string) => Promise<string>;
  renameBlob: (hash: string, filename: string) => Promise<void>;
  deleteAsset: (assetId: string) => Promise<void>;
  uploadFiles: (files: FileList) => Promise<void>;
  getBlobUrl: (sha256: string) => string;
}

interface LibraryLeftSidebarProps {
  operations: LibraryLeftSidebarOperations;
  // Component injection (LinkBlobDialog needs separate optimization)
  LinkBlobDialog: React.ComponentType<{
    blob: BlobWithMetadata;
    onSuccess: () => void;
    onCancel: () => void;
  }>;
}

export function LibraryLeftSidebar({
  operations,
  LinkBlobDialog,
}: LibraryLeftSidebarProps) {
  const { fetchBlobContent, renameBlob, deleteAsset, uploadFiles, getBlobUrl } =
    operations;

  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  // Handle file uploads
  const handleFileUpload = async (files: FileList) => {
    setIsUploading(true);
    try {
      await uploadFiles(files);
    } catch (error) {
      logger.error("ui", "File upload failed", {
        error,
        fileCount: files.length,
      });
      alert(
        `Upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setDragCounter((prev) => prev + 1);
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDraggingOver(false);
      }
      return newCount;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    setDragCounter(0);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  };

  return (
    <>
      <div
        className={`w-72 bg-neutral-900/50 border-r border-neutral-800 overflow-y-auto relative ${
          isDraggingOver ? "ring-2 ring-blue-500/50 ring-inset" : ""
        }`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Upload overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-blue-500/20 border-2 border-dashed border-blue-500/50 rounded-lg px-6 py-4">
              <p className="text-sm font-medium text-blue-400">
                Drop files to upload
              </p>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-neutral-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-neutral-800 border border-neutral-700 rounded-lg px-6 py-4">
              <p className="text-sm font-medium text-neutral-200">
                Uploading files...
              </p>
            </div>
          </div>
        )}

        <div className="p-3 space-y-4">
          {/* Unlinked Assets Section */}
          <UnlinkedAssetsList
            operations={{
              renameBlob,
              fetchBlobContent,
              deleteAsset,
            }}
            onViewAsset={(asset: Asset) => setViewingAsset(asset)}
            LinkBlobDialog={LinkBlobDialog}
            getBlobUrl={getBlobUrl}
          />
        </div>
      </div>

      {/* PDF Viewer for assets */}
      {viewingAsset && (
        <SimplePDFViewer
          sha256={viewingAsset.sha256}
          title={viewingAsset.filename || "Untitled"}
          onClose={() => setViewingAsset(null)}
          getBlobUrl={getBlobUrl}
        />
      )}
    </>
  );
}
