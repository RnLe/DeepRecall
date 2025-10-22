/**
 * FileInbox Component
 * Displays new files (inbox) - orphaned blobs that have never been touched
 */

"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileQuestion, Link, ChevronDown, ChevronUp } from "lucide-react";
import { useOrphanedBlobs } from "@/src/hooks/useBlobs";
import { MarkdownPreview } from "../reader/MarkdownPreview";
import type { BlobWithMetadata } from "@/src/schema/blobs";

interface FileInboxProps {
  onLinkBlob: (blob: BlobWithMetadata) => void;
  onViewBlob: (blob: BlobWithMetadata) => void;
}

export function FileInbox({ onLinkBlob, onViewBlob }: FileInboxProps) {
  const queryClient = useQueryClient();
  const { data: newFiles } = useOrphanedBlobs();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    blob: BlobWithMetadata;
  } | null>(null);
  const [renamingBlob, setRenamingBlob] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [viewingMarkdown, setViewingMarkdown] = useState<{
    blob: BlobWithMetadata;
    content: string;
  } | null>(null);

  const hasNewFiles = newFiles && newFiles.length > 0;

  // Helper to get filename without extension for display
  const getDisplayName = (filename: string | null) => {
    if (!filename) return "Untitled";
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex > 0) {
      return filename.substring(0, lastDotIndex);
    }
    return filename;
  };

  // Helper to get file extension from filename
  const getFileExt = (filename: string | null) => {
    if (!filename) return "";
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex > 0 && lastDotIndex < filename.length - 1) {
      return filename.substring(lastDotIndex);
    }
    return "";
  };

  // Helper to format file metadata based on file type
  const getFileMetadata = (
    mime: string,
    pageCount?: number,
    imageWidth?: number,
    imageHeight?: number,
    lineCount?: number
  ) => {
    // PDF files: show page count
    if (mime === "application/pdf" && pageCount) {
      return `${pageCount} ${pageCount === 1 ? "page" : "pages"}`;
    }

    // Images: show resolution
    if (mime.startsWith("image/") && imageWidth && imageHeight) {
      return `${imageWidth}×${imageHeight}`;
    }

    // Text files: show line count
    if (
      (mime === "text/plain" ||
        mime === "text/markdown" ||
        mime.startsWith("text/")) &&
      lineCount
    ) {
      return `${lineCount} ${lineCount === 1 ? "line" : "lines"}`;
    }

    return null;
  };

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

  // Handle rename
  const handleRename = async (
    hash: string,
    newFilename: string,
    originalFilename: string | null
  ) => {
    try {
      // Get the original extension
      const originalExt = getFileExt(originalFilename);

      // If user provided extension, strip it
      let finalFilename = newFilename;
      if (originalExt && finalFilename.endsWith(originalExt)) {
        finalFilename = finalFilename.substring(
          0,
          finalFilename.length - originalExt.length
        );
      }

      // Add the original extension back
      finalFilename = finalFilename + originalExt;

      const response = await fetch(`/api/library/blobs/${hash}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: finalFilename }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Rename failed");
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setRenamingBlob(null);
    } catch (error) {
      console.error("Rename failed:", error);
      alert(
        `Rename failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  // Handle delete
  const handleDelete = async (hash: string) => {
    try {
      const response = await fetch(`/api/library/blobs/${hash}/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteFile: true }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Delete failed");
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setPendingDelete(null);
    } catch (error) {
      console.error("Delete failed:", error);
      alert(
        `Delete failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  // Close context menu when clicking outside
  const handleClickOutside = () => {
    setContextMenu(null);
    setPendingDelete(null);
  };

  // Handle viewing markdown files
  const handleViewMarkdown = async (blob: BlobWithMetadata) => {
    try {
      const response = await fetch(`/api/blob/${blob.sha256}`);
      if (!response.ok) throw new Error("Failed to fetch file");
      const text = await response.text();
      setViewingMarkdown({ blob, content: text });
    } catch (error) {
      console.error("Failed to load markdown:", error);
      alert("Failed to load markdown file");
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
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
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded transition-colors"
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Empty state */}
      {!hasNewFiles && (
        <div className="bg-neutral-800/30 border border-neutral-700/50 rounded-lg p-3 flex flex-col items-center justify-center text-center">
          <FileQuestion className="w-8 h-8 text-neutral-600 mb-1.5" />
          <p className="text-xs text-neutral-500">No new files</p>
        </div>
      )}

      {/* Compact list */}
      {hasNewFiles && !isCollapsed && (
        <div
          className="space-y-1.5"
          onDragOver={(e) => {
            // Allow dropping from unlinked assets back to inbox
            if (e.dataTransfer.types.includes("application/x-asset-id")) {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "move";
            }
          }}
          onDrop={(e) => {
            // Handle asset being moved back to inbox
            const assetId = e.dataTransfer.getData("application/x-asset-id");
            if (assetId) {
              e.preventDefault();
              e.stopPropagation();
              // This will be handled by parent component
            }
          }}
        >
          {newFiles.map((blob) => {
            const isRenaming = renamingBlob === blob.sha256;
            const displayName = getDisplayName(blob.filename);
            const fileExt = getFileExtension(blob.filename, blob.mime);
            const colors = getFileTypeColor(fileExt);
            const metadata = getFileMetadata(
              blob.mime,
              blob.pageCount,
              blob.imageWidth,
              blob.imageHeight,
              blob.lineCount
            );

            return (
              <div
                key={blob.sha256}
                draggable={!isRenaming}
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/x-deeprecall-blob",
                    JSON.stringify(blob)
                  );
                  e.dataTransfer.setData("application/x-blob-id", blob.sha256);
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
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, blob });
                }}
                onClick={() => {
                  if (!isRenaming) {
                    if (blob.mime === "application/pdf") {
                      onViewBlob(blob);
                    } else if (
                      blob.mime === "text/markdown" ||
                      blob.mime === "text/plain" ||
                      blob.filename?.endsWith(".md") ||
                      blob.filename?.endsWith(".markdown")
                    ) {
                      handleViewMarkdown(blob);
                    }
                  }
                }}
                className="bg-neutral-900/30 border border-amber-900/30 rounded-lg p-1.5 hover:border-amber-800/50 transition-colors cursor-move hover:cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {/* Filename - editable or clickable */}
                  {isRenaming ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => {
                        if (renameValue.trim() && renameValue !== displayName) {
                          handleRename(
                            blob.sha256,
                            renameValue.trim(),
                            blob.filename
                          );
                        } else {
                          setRenamingBlob(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (
                            renameValue.trim() &&
                            renameValue !== displayName
                          ) {
                            handleRename(
                              blob.sha256,
                              renameValue.trim(),
                              blob.filename
                            );
                          } else {
                            setRenamingBlob(null);
                          }
                        } else if (e.key === "Escape") {
                          setRenamingBlob(null);
                        }
                      }}
                      autoFocus
                      className="flex-1 min-w-0 text-sm text-neutral-300 font-medium bg-neutral-800 border border-neutral-700 rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                    />
                  ) : (
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm text-neutral-300 font-medium truncate hover:text-neutral-100 transition-colors">
                        {displayName}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-600 mt-0.5">
                        <span
                          className={`${colors.bg} ${colors.text} ${colors.border} border px-1 py-0.5 rounded text-[10px] font-medium`}
                        >
                          {fileExt}
                        </span>
                        <span>{(blob.size / 1024 / 1024).toFixed(2)} MB</span>
                        {metadata && (
                          <>
                            <span>·</span>
                            <span>{metadata}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Link button */}
                  {!isRenaming && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onLinkBlob(blob);
                      }}
                      className="flex-shrink-0 p-1.5 text-amber-500 hover:bg-amber-500/10 rounded transition-colors"
                      title="Link to work"
                    >
                      <Link className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <>
          {/* Backdrop to close menu */}
          <div className="fixed inset-0 z-40" onClick={handleClickOutside} />

          {/* Menu */}
          <div
            className="fixed z-50 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                setRenamingBlob(contextMenu.blob.sha256);
                setRenameValue(getDisplayName(contextMenu.blob.filename));
                setContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              Rename
            </button>
            <button
              onClick={() => {
                onLinkBlob(contextMenu.blob);
                setContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              Link to work
            </button>
            <button
              onClick={() => {
                if (pendingDelete === contextMenu.blob.sha256) {
                  handleDelete(contextMenu.blob.sha256);
                  setContextMenu(null);
                } else {
                  setPendingDelete(contextMenu.blob.sha256);
                }
              }}
              className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                pendingDelete === contextMenu.blob.sha256
                  ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
                  : "text-red-500 hover:bg-neutral-700"
              }`}
            >
              {pendingDelete === contextMenu.blob.sha256
                ? "Click again to remove"
                : "Remove"}
            </button>
          </div>
        </>
      )}

      {/* Markdown Viewer */}
      {viewingMarkdown && (
        <MarkdownPreview
          initialContent={viewingMarkdown.content}
          title={viewingMarkdown.blob.filename || "Markdown Preview"}
          sha256={viewingMarkdown.blob.sha256}
          onClose={() => setViewingMarkdown(null)}
          onSaved={(newHash) => {
            // Update the viewing markdown with new hash
            setViewingMarkdown((prev) =>
              prev ? { ...prev, blob: { ...prev.blob, sha256: newHash } } : null
            );
            // Trigger a refresh of the blobs list
            queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
          }}
        />
      )}
    </div>
  );
}
