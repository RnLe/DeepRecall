/**
 * LibraryLeftSidebar Component (Platform-agnostic)
 * Container for new files (inbox) and unlinked assets sections
 */

import React, { useState, useEffect } from "react";
import type { BlobWithMetadata } from "@deeprecall/core";
import type { Asset } from "@deeprecall/core";

// Platform-agnostic blob operations interface
export interface BlobOperations {
  fetchOrphanedBlobs: () => Promise<BlobWithMetadata[]>;
  fetchBlobContent: (sha256: string) => Promise<string>;
  renameBlob: (hash: string, filename: string) => Promise<void>;
  deleteBlob: (hash: string) => Promise<void>;
  uploadFiles: (files: FileList) => Promise<void>;
}

// Platform-agnostic asset operations interface
export interface AssetOperations {
  createAsset: (asset: {
    kind: "asset";
    sha256: string;
    filename: string;
    bytes: number;
    mime: string;
    pageCount?: number | null;
    role:
      | "main"
      | "notes"
      | "slides"
      | "data"
      | "supplement"
      | "solutions"
      | "exercises"
      | "thumbnail";
    favorite: boolean;
  }) => Promise<void>;
  deleteAsset: (assetId: string) => Promise<void>;
}

interface LibraryLeftSidebarProps {
  // Operations
  blobOps: BlobOperations;
  assetOps: AssetOperations;

  // Component dependencies - injected from platform
  FileInbox: React.ComponentType<{
    newFiles: BlobWithMetadata[];
    onLinkBlob: (blob: BlobWithMetadata) => void;
    onViewBlob: (blob: BlobWithMetadata) => void;
    onRenameBlob: (hash: string, newFilename: string) => Promise<void>;
    onDeleteBlob: (hash: string) => Promise<void>;
    onRefreshBlobs: () => void;
    fetchBlobContent: (sha256: string) => Promise<string>;
    MarkdownPreview: React.ComponentType<{
      initialContent: string;
      title: string;
      sha256: string;
      onClose: () => void;
      onSaved: (newHash: string) => void;
    }>;
  }>;

  UnlinkedAssetsList: React.ComponentType<{
    onLinkAsset: (asset: Asset) => void;
    onViewAsset: (asset: Asset) => void;
    onMoveToInbox: (assetId: string) => Promise<void>;
  }>;

  LinkBlobDialog: React.ComponentType<{
    blob: BlobWithMetadata;
    onSuccess: () => void;
    onCancel: () => void;
  }>;

  SimplePDFViewer: React.ComponentType<{
    sha256: string;
    title: string;
    onClose: () => void;
  }>;

  MarkdownPreview: React.ComponentType<{
    initialContent: string;
    title: string;
    sha256: string;
    onClose: () => void;
    onSaved: (newHash: string) => void;
  }>;
}

export function LibraryLeftSidebar({
  blobOps,
  assetOps,
  FileInbox,
  UnlinkedAssetsList,
  LinkBlobDialog,
  SimplePDFViewer,
  MarkdownPreview,
}: LibraryLeftSidebarProps) {
  const [linkingBlob, setLinkingBlob] = useState<BlobWithMetadata | null>(null);
  const [viewingBlob, setViewingBlob] = useState<BlobWithMetadata | null>(null);
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [orphanedBlobs, setOrphanedBlobs] = useState<BlobWithMetadata[]>([]);

  // Fetch orphaned blobs
  const refreshOrphanedBlobs = async () => {
    try {
      const blobs = await blobOps.fetchOrphanedBlobs();
      setOrphanedBlobs(blobs);
    } catch (error) {
      console.error("Failed to fetch orphaned blobs:", error);
    }
  };

  // Initial fetch
  useEffect(() => {
    refreshOrphanedBlobs();
  }, []);

  // Handle converting blob to asset when dropped on unlinked assets section
  const handleConvertBlobToAsset = async (blob: BlobWithMetadata) => {
    try {
      // Create asset from blob using Electric
      await assetOps.createAsset({
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
      await assetOps.deleteAsset(assetId);

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
      await blobOps.uploadFiles(files);

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
            onLinkBlob={(blob) => setLinkingBlob(blob)}
            onViewBlob={(blob) => setViewingBlob(blob)}
            onRenameBlob={blobOps.renameBlob}
            onDeleteBlob={blobOps.deleteBlob}
            onRefreshBlobs={refreshOrphanedBlobs}
            fetchBlobContent={blobOps.fetchBlobContent}
            MarkdownPreview={MarkdownPreview}
          />

          {/* Unlinked Assets Section */}
          <UnlinkedAssetsList
            onLinkAsset={(asset) => {
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
            onViewAsset={(asset) => setViewingAsset(asset)}
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
        />
      )}

      {/* PDF Viewer for assets */}
      {viewingAsset && (
        <SimplePDFViewer
          sha256={viewingAsset.sha256}
          title={viewingAsset.filename || "Untitled"}
          onClose={() => setViewingAsset(null)}
        />
      )}
    </>
  );
}
