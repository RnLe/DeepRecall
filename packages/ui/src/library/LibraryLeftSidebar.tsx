/**
 * LibraryLeftSidebar Component (Platform-agnostic)
 * Container for new files (inbox) and unlinked assets sections
 * Uses Electric hooks and imports components directly
 */

import React, { useState } from "react";
import type { BlobWithMetadata } from "@deeprecall/core";
import type { Asset } from "@deeprecall/core";
import { assetsElectric } from "@deeprecall/data/repos";
import { FileInbox } from "./FileInbox";
import { UnlinkedAssetsList } from "./UnlinkedAssetsList";
import { SimplePDFViewer } from "../components/SimplePDFViewer";
import { MarkdownPreview } from "../components/MarkdownPreview";

// Platform-specific operations interface (minimal)
export interface LibraryLeftSidebarOperations {
  // Blob operations (require server CAS access)
  fetchOrphanedBlobs: () => Promise<BlobWithMetadata[]>;
  orphanedBlobs: BlobWithMetadata[];
  isLoadingBlobs: boolean;
  fetchBlobContent: (sha256: string) => Promise<string>;
  renameBlob: (hash: string, filename: string) => Promise<void>;
  deleteBlob: (hash: string) => Promise<void>;
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
  const {
    orphanedBlobs,
    isLoadingBlobs,
    fetchOrphanedBlobs,
    fetchBlobContent,
    renameBlob,
    deleteBlob,
    uploadFiles,
    getBlobUrl,
  } = operations;

  const [linkingBlob, setLinkingBlob] = useState<BlobWithMetadata | null>(null);
  const [viewingBlob, setViewingBlob] = useState<BlobWithMetadata | null>(null);
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  // Refetch function for when blobs are modified
  const refreshOrphanedBlobs = async () => {
    try {
      await fetchOrphanedBlobs();
    } catch (error) {
      console.error("Failed to refresh orphaned blobs:", error);
    }
  };

  // Handle converting blob to asset when dropped on unlinked assets section
  const handleConvertBlobToAsset = async (blob: BlobWithMetadata) => {
    try {
      // Create asset from blob using Electric
      await assetsElectric.createAsset({
        kind: "asset",
        sha256: blob.sha256,
        filename: blob.filename || "Untitled",
        bytes: blob.size,
        mime: blob.mime,
        pageCount: blob.pageCount,
        role: "main",
        favorite: false,
      });

      // Refresh data - blob will now appear as unlinked asset
      await refreshOrphanedBlobs();
    } catch (error) {
      console.error("Convert to asset failed:", error);
      alert(
        `Convert to asset failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Handle move asset to inbox (remove from Electric, becomes orphaned blob)
  const handleMoveToInbox = async (assetId: string) => {
    try {
      await assetsElectric.deleteAsset(assetId);

      // Refresh data - asset will now appear as orphaned blob
      await refreshOrphanedBlobs();
    } catch (error) {
      console.error("Move to inbox failed:", error);
      alert(
        `Move to inbox failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Handle file uploads
  const handleFileUpload = async (files: FileList) => {
    setIsUploading(true);
    try {
      await uploadFiles(files);

      // Refresh the orphaned blobs list
      await refreshOrphanedBlobs();
    } catch (error) {
      console.error("File upload failed:", error);
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
          {/* New Files (Inbox) Section */}
          <FileInbox
            newFiles={orphanedBlobs}
            onLinkBlob={(blob: BlobWithMetadata) => setLinkingBlob(blob)}
            onViewBlob={(blob: BlobWithMetadata) => setViewingBlob(blob)}
            onRenameBlob={renameBlob}
            onDeleteBlob={deleteBlob}
            onRefreshBlobs={refreshOrphanedBlobs}
            fetchBlobContent={fetchBlobContent}
          />

          {/* Unlinked Assets Section */}
          <UnlinkedAssetsList
            operations={{
              renameBlob,
              fetchBlobContent,
            }}
            onLinkAsset={(asset: Asset) => {
              // Convert asset to blob format for LinkBlobDialog
              const blobData: BlobWithMetadata = {
                sha256: asset.sha256,
                size: asset.bytes,
                mime: asset.mime,
                filename: asset.filename,
                pageCount: asset.pageCount,
                path: null,
                mtime_ms: Date.now(),
                created_ms: Date.now(),
              };
              setLinkingBlob(blobData);
            }}
            onViewAsset={(asset: Asset) => setViewingAsset(asset)}
            onMoveToInbox={handleMoveToInbox}
          />
        </div>
      </div>

      {/* Link dialog */}
      {linkingBlob && (
        <LinkBlobDialog
          blob={linkingBlob}
          onSuccess={() => {
            setLinkingBlob(null);
            refreshOrphanedBlobs();
          }}
          onCancel={() => setLinkingBlob(null)}
        />
      )}

      {/* PDF Viewer for blobs */}
      {viewingBlob && (
        <SimplePDFViewer
          sha256={viewingBlob.sha256}
          title={viewingBlob.filename || "Untitled"}
          onClose={() => setViewingBlob(null)}
          getBlobUrl={getBlobUrl}
        />
      )}

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
