/**
 * LibraryLeftSidebar Component
 * Container for new files (inbox) and unlinked assets sections
 */

"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileInbox } from "./FileInbox";
import { UnlinkedAssetsList } from "./UnlinkedAssetsList";
import { LinkBlobDialog } from "./LinkBlobDialog";
import { SimplePDFViewer } from "../reader/SimplePDFViewer";
import type { BlobWithMetadata } from "@deeprecall/core/schemas/blobs";
import type { Asset } from "@deeprecall/core/schemas/library";

interface LibraryLeftSidebarProps {
  onCreateWorkWithPreset?: (presetId: string) => void;
}

export function LibraryLeftSidebar({
  onCreateWorkWithPreset,
}: LibraryLeftSidebarProps) {
  const queryClient = useQueryClient();
  const [linkingBlob, setLinkingBlob] = useState<BlobWithMetadata | null>(null);
  const [linkingAsset, setLinkingAsset] = useState<Asset | null>(null);
  const [viewingBlob, setViewingBlob] = useState<BlobWithMetadata | null>(null);
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  // Handle converting blob to asset when dropped on unlinked assets section
  const handleConvertBlobToAsset = async (blob: BlobWithMetadata) => {
    try {
      const { db } = await import("@/src/db/dexie");
      const { nanoid } = await import("nanoid");

      // Create asset from blob
      await db.assets.add({
        id: nanoid(),
        kind: "asset",
        sha256: blob.sha256,
        filename: blob.filename || "Untitled",
        bytes: blob.size,
        mime: blob.mime,
        pageCount: blob.pageCount,
        role: "main",
        favorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Refresh data - blob will now appear as unlinked asset
      queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
    } catch (error) {
      console.error("Convert to asset failed:", error);
      alert(
        `Convert to asset failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  // Handle move asset to inbox (remove from Dexie, becomes orphaned blob)
  const handleMoveToInbox = async (assetId: string) => {
    try {
      const { db } = await import("@/src/db/dexie");
      await db.assets.delete(assetId);

      // Refresh data - asset will now appear as orphaned blob
      queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
    } catch (error) {
      console.error("Move to inbox failed:", error);
      alert(
        `Move to inbox failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  // Handle file uploads
  const handleFileUpload = async (files: FileList) => {
    setIsUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("metadata", JSON.stringify({ role: "main" }));

        const response = await fetch("/api/library/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }

        return response.json();
      });

      await Promise.all(uploadPromises);

      // Refresh the orphaned blobs list
      queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
    } catch (error) {
      console.error("File upload failed:", error);
      alert(
        `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
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
            onLinkBlob={(blob) => setLinkingBlob(blob)}
            onViewBlob={(blob) => setViewingBlob(blob)}
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
            queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
            queryClient.invalidateQueries({ queryKey: ["files"] });
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
