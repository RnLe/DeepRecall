/**
 * LibraryLeftSidebar Component
 * Displays new files (inbox) and unlinked assets for quick access
 */

"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  FileQuestion,
  Link,
  FileText,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";
import { useOrphanedBlobs, useUnlinkedAssets } from "@/src/hooks/useBlobs";
import { LinkBlobDialog } from "./LinkBlobDialog";
import { SimplePDFViewer } from "../reader/SimplePDFViewer";
import type { BlobWithMetadata } from "@/src/schema/blobs";
import type { Asset } from "@/src/schema/library";

interface LibraryLeftSidebarProps {
  onCreateWorkWithPreset?: (presetId: string) => void;
}

export function LibraryLeftSidebar({
  onCreateWorkWithPreset,
}: LibraryLeftSidebarProps) {
  const queryClient = useQueryClient();
  const { data: newFiles } = useOrphanedBlobs();
  const unlinkedAssets = useUnlinkedAssets();
  const [linkingBlob, setLinkingBlob] = useState<BlobWithMetadata | null>(null);
  const [viewingBlob, setViewingBlob] = useState<BlobWithMetadata | null>(null);
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [isNewFilesCollapsed, setIsNewFilesCollapsed] = useState(false);
  const [isUnlinkedCollapsed, setIsUnlinkedCollapsed] = useState(false);

  const hasNewFiles = newFiles && newFiles.length > 0;
  const hasUnlinkedAssets = unlinkedAssets && unlinkedAssets.length > 0;

  // Helper to get file extension from filename or mime type
  const getFileExtension = (filename: string | null, mime: string) => {
    if (filename) {
      const ext = filename.split(".").pop()?.toUpperCase();
      if (ext && ext.length <= 4) return ext;
    }
    // Fallback to mime type
    const mimeMap: Record<string, string> = {
      "application/pdf": "PDF",
      "image/png": "PNG",
      "image/jpeg": "JPG",
      "image/gif": "GIF",
      "text/markdown": "MD",
      "text/plain": "TXT",
      "application/zip": "ZIP",
    };
    return mimeMap[mime] || "FILE";
  };

  // Helper to get color for file type
  const getFileTypeColor = (ext: string) => {
    const colorMap: Record<
      string,
      { bg: string; text: string; border: string }
    > = {
      PDF: {
        bg: "bg-red-500/20",
        text: "text-red-400",
        border: "border-red-500/40",
      },
      PNG: {
        bg: "bg-purple-500/20",
        text: "text-purple-400",
        border: "border-purple-500/40",
      },
      JPG: {
        bg: "bg-purple-500/20",
        text: "text-purple-400",
        border: "border-purple-500/40",
      },
      JPEG: {
        bg: "bg-purple-500/20",
        text: "text-purple-400",
        border: "border-purple-500/40",
      },
      GIF: {
        bg: "bg-purple-500/20",
        text: "text-purple-400",
        border: "border-purple-500/40",
      },
      MD: {
        bg: "bg-blue-500/20",
        text: "text-blue-400",
        border: "border-blue-500/40",
      },
      TXT: {
        bg: "bg-gray-500/20",
        text: "text-gray-400",
        border: "border-gray-500/40",
      },
      ZIP: {
        bg: "bg-yellow-500/20",
        text: "text-yellow-400",
        border: "border-yellow-500/40",
      },
    };
    return (
      colorMap[ext] || {
        bg: "bg-neutral-500/20",
        text: "text-neutral-400",
        border: "border-neutral-500/40",
      }
    );
  };

  return (
    <>
      <div className="w-72 bg-neutral-900/50 border-r border-neutral-800 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* New Files (Inbox) Section */}
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileQuestion className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-neutral-200">
                  New Files (Inbox)
                  {hasNewFiles && (
                    <span className="text-xs font-normal text-neutral-500 ml-2">
                      ({newFiles.length})
                    </span>
                  )}
                </h3>
              </div>

              {hasNewFiles && (
                <button
                  onClick={() => setIsNewFilesCollapsed(!isNewFilesCollapsed)}
                  className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded transition-colors"
                  title={isNewFilesCollapsed ? "Expand" : "Collapse"}
                >
                  {isNewFilesCollapsed ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronUp className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            {/* Empty state */}
            {!hasNewFiles && (
              <div className="bg-neutral-800/30 border border-neutral-700/50 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                <FileQuestion className="w-8 h-8 text-neutral-600 mb-2" />
                <p className="text-xs text-neutral-500">No new files</p>
              </div>
            )}

            {/* Compact list */}
            {hasNewFiles && !isNewFilesCollapsed && (
              <div className="space-y-2">
                {newFiles.map((blob) => (
                  <div
                    key={blob.sha256}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "application/x-deeprecall-blob",
                        JSON.stringify(blob)
                      );
                      e.dataTransfer.setData(
                        "application/x-blob-id",
                        blob.sha256
                      );
                      e.dataTransfer.effectAllowed = "link";
                      if (e.currentTarget instanceof HTMLElement) {
                        e.currentTarget.style.opacity = "0.5";
                      }
                    }}
                    onDragEnd={(e) => {
                      if (e.currentTarget instanceof HTMLElement) {
                        e.currentTarget.style.opacity = "1";
                      }
                    }}
                    className="bg-neutral-900/30 border border-amber-900/30 rounded-lg p-2 hover:border-amber-800/50 transition-colors cursor-move"
                  >
                    <div className="flex items-center gap-2">
                      {/* File type badge - clickable for PDF preview */}
                      {(() => {
                        const ext = getFileExtension(blob.filename, blob.mime);
                        const colors = getFileTypeColor(ext);
                        return (
                          <button
                            onClick={() => {
                              if (blob.mime === "application/pdf") {
                                setViewingBlob(blob);
                              }
                            }}
                            className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center border ${colors.bg} ${colors.border} hover:brightness-110 transition-all`}
                          >
                            <span
                              className={`text-[9px] font-bold ${colors.text}`}
                            >
                              {ext}
                            </span>
                          </button>
                        );
                      })()}

                      {/* Filename & size - clickable for PDF preview */}
                      <button
                        onClick={() => {
                          if (blob.mime === "application/pdf") {
                            setViewingBlob(blob);
                          }
                        }}
                        className="flex-1 min-w-0 text-left"
                      >
                        <h4 className="text-xs text-neutral-300 font-medium truncate hover:text-neutral-100 transition-colors">
                          {blob.filename}
                        </h4>
                        <div className="flex items-center gap-1 text-[10px] text-neutral-600 mt-0.5">
                          <span>{(blob.size / 1024 / 1024).toFixed(1)} MB</span>
                          {blob.pageCount && (
                            <>
                              <span>·</span>
                              <span>{blob.pageCount}p</span>
                            </>
                          )}
                        </div>
                      </button>

                      {/* Link button */}
                      <button
                        onClick={() => setLinkingBlob(blob)}
                        className="flex-shrink-0 p-1 text-amber-500 hover:bg-amber-500/10 rounded transition-colors"
                        title="Link to work"
                      >
                        <Link className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unlinked Assets Section */}
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-neutral-200">
                  Unlinked Assets
                  {hasUnlinkedAssets && (
                    <span className="text-xs font-normal text-neutral-500 ml-2">
                      ({unlinkedAssets.length})
                    </span>
                  )}
                </h3>
              </div>

              {hasUnlinkedAssets && (
                <button
                  onClick={() => setIsUnlinkedCollapsed(!isUnlinkedCollapsed)}
                  className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded transition-colors"
                  title={isUnlinkedCollapsed ? "Expand" : "Collapse"}
                >
                  {isUnlinkedCollapsed ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronUp className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            {/* Empty state */}
            {!hasUnlinkedAssets && (
              <div className="bg-neutral-800/30 border border-neutral-700/50 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                <Package className="w-8 h-8 text-neutral-600 mb-2" />
                <p className="text-xs text-neutral-500">No unlinked assets</p>
              </div>
            )}

            {/* Compact list */}
            {hasUnlinkedAssets && !isUnlinkedCollapsed && (
              <div className="space-y-2">
                {unlinkedAssets.map((asset) => (
                  <div
                    key={asset.id}
                    draggable
                    onDragStart={(e) => {
                      // Set asset ID for activity/work drops
                      e.dataTransfer.setData(
                        "application/x-asset-id",
                        asset.id
                      );
                      // Also set blob data for library area drops
                      const blobData = {
                        sha256: asset.sha256,
                        size: asset.bytes,
                        mime: asset.mime,
                        filename: asset.filename,
                        pageCount: asset.pageCount,
                        path: null,
                      };
                      e.dataTransfer.setData(
                        "application/x-deeprecall-blob",
                        JSON.stringify(blobData)
                      );
                      e.dataTransfer.setData(
                        "application/x-blob-id",
                        asset.sha256
                      );
                      e.dataTransfer.effectAllowed = "link";
                      if (e.currentTarget instanceof HTMLElement) {
                        e.currentTarget.style.opacity = "0.5";
                      }
                    }}
                    onDragEnd={(e) => {
                      if (e.currentTarget instanceof HTMLElement) {
                        e.currentTarget.style.opacity = "1";
                      }
                    }}
                    className="bg-neutral-900/30 border border-blue-900/30 rounded-lg p-2 hover:border-blue-800/50 transition-colors cursor-move"
                  >
                    <div className="flex items-center gap-2">
                      {/* File type badge - clickable for PDF preview */}
                      {(() => {
                        const ext = getFileExtension(
                          asset.filename,
                          asset.mime
                        );
                        const colors = getFileTypeColor(ext);
                        return (
                          <button
                            onClick={() => {
                              if (asset.mime === "application/pdf") {
                                setViewingAsset(asset);
                              }
                            }}
                            className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center border ${colors.bg} ${colors.border} hover:brightness-110 transition-all`}
                          >
                            <span
                              className={`text-[9px] font-bold ${colors.text}`}
                            >
                              {ext}
                            </span>
                          </button>
                        );
                      })()}

                      {/* Filename & size - clickable for PDF preview */}
                      <button
                        onClick={() => {
                          if (asset.mime === "application/pdf") {
                            setViewingAsset(asset);
                          }
                        }}
                        className="flex-1 min-w-0 text-left"
                      >
                        <h4 className="text-xs text-neutral-300 font-medium truncate hover:text-neutral-100 transition-colors">
                          {asset.filename}
                        </h4>
                        <div className="flex items-center gap-1 text-[10px] text-neutral-600 mt-0.5">
                          <span>
                            {(asset.bytes / 1024 / 1024).toFixed(1)} MB
                          </span>
                          {asset.pageCount && (
                            <>
                              <span>·</span>
                              <span>{asset.pageCount}p</span>
                            </>
                          )}
                          <span>·</span>
                          <span className="text-blue-500">Asset</span>
                        </div>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
