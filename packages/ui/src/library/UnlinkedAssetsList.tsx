/**
 * UnlinkedAssetsList Component
 * Displays assets that were created but are not currently linked to any work or activity
 */

"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Package, Link, ChevronDown, ChevronUp } from "lucide-react";
import { useUnlinkedAssets } from "@/src/hooks/useBlobs";
import { MarkdownPreview } from "../reader/MarkdownPreview";
import type { Asset } from "@deeprecall/core/schemas/library";

interface UnlinkedAssetsListProps {
  onLinkAsset: (asset: Asset) => void;
  onViewAsset: (asset: Asset) => void;
  onMoveToInbox: (assetId: string) => void;
}

export function UnlinkedAssetsList({
  onLinkAsset,
  onViewAsset,
  onMoveToInbox,
}: UnlinkedAssetsListProps) {
  const queryClient = useQueryClient();
  const unlinkedAssets = useUnlinkedAssets();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [assetContextMenu, setAssetContextMenu] = useState<{
    x: number;
    y: number;
    asset: Asset;
  } | null>(null);
  const [renamingAsset, setRenamingAsset] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [viewingMarkdown, setViewingMarkdown] = useState<{
    asset: Asset;
    content: string;
  } | null>(null);

  const hasUnlinkedAssets = unlinkedAssets && unlinkedAssets.length > 0;

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
  const getFileMetadata = (mime: string, pageCount?: number) => {
    // PDF files: show page count
    if (mime === "application/pdf" && pageCount) {
      return `${pageCount} ${pageCount === 1 ? "page" : "pages"}`;
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

  // Handle asset rename
  const handleAssetRename = async (
    assetId: string,
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

      // Rename on server (updates SQLite DB and file on disk)
      const response = await fetch(`/api/library/blobs/${hash}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: finalFilename }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Rename failed");
      }

      // Update asset in Dexie
      const { db } = await import("@/src/db/dexie");
      await db.assets.update(assetId, {
        filename: finalFilename,
        updatedAt: new Date().toISOString(),
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setRenamingAsset(null);
    } catch (error) {
      console.error("Rename failed:", error);
      alert(
        `Rename failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  // Handle asset delete
  const handleAssetDelete = async (assetId: string, hash: string) => {
    try {
      // Delete asset from Dexie
      const { db } = await import("@/src/db/dexie");
      await db.assets.delete(assetId);

      // Also delete blob from server
      const response = await fetch(`/api/library/blobs/${hash}/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteFile: true }),
      });

      if (!response.ok) {
        console.warn(
          "Failed to delete blob from server, but asset was removed from Dexie"
        );
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
    setAssetContextMenu(null);
    setPendingDelete(null);
  };

  // Handle viewing markdown files
  const handleViewMarkdown = async (asset: Asset) => {
    try {
      const response = await fetch(`/api/blob/${asset.sha256}`);
      if (!response.ok) throw new Error("Failed to fetch file");
      const text = await response.text();
      setViewingMarkdown({ asset, content: text });
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
      {!hasUnlinkedAssets && (
        <div className="bg-neutral-800/30 border border-neutral-700/50 rounded-lg p-3 flex flex-col items-center justify-center text-center">
          <Package className="w-8 h-8 text-neutral-600 mb-1.5" />
          <p className="text-xs text-neutral-500">No unlinked assets</p>
        </div>
      )}

      {/* Compact list */}
      {hasUnlinkedAssets && !isCollapsed && (
        <div
          className="space-y-1.5"
          onDragOver={(e) => {
            // Allow dropping from inbox to convert to asset
            if (e.dataTransfer.types.includes("application/x-blob-id")) {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={(e) => {
            // Handle blob being converted to asset
            const blobId = e.dataTransfer.getData("application/x-blob-id");
            if (blobId) {
              e.preventDefault();
              e.stopPropagation();
              // This will be handled by parent component
            }
          }}
        >
          {unlinkedAssets.map((asset) => {
            const isRenaming = renamingAsset === asset.id;
            const displayName = getDisplayName(asset.filename);
            const fileExt = getFileExtension(asset.filename, asset.mime);
            const colors = getFileTypeColor(fileExt);
            const metadata = getFileMetadata(asset.mime, asset.pageCount);

            return (
              <div
                key={asset.id}
                draggable={!isRenaming}
                onDragStart={(e) => {
                  // Set asset ID for activity/work drops
                  e.dataTransfer.setData("application/x-asset-id", asset.id);
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
                  e.dataTransfer.setData("application/x-blob-id", asset.sha256);
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
                  setAssetContextMenu({ x: e.clientX, y: e.clientY, asset });
                }}
                onClick={() => {
                  if (!isRenaming) {
                    if (asset.mime === "application/pdf") {
                      onViewAsset(asset);
                    } else if (
                      asset.mime === "text/markdown" ||
                      asset.mime === "text/plain" ||
                      asset.filename?.endsWith(".md") ||
                      asset.filename?.endsWith(".markdown")
                    ) {
                      handleViewMarkdown(asset);
                    }
                  }
                }}
                className="bg-neutral-900/30 border border-blue-900/30 rounded-lg p-1.5 hover:border-blue-800/50 transition-colors cursor-move hover:cursor-pointer"
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
                          handleAssetRename(
                            asset.id,
                            asset.sha256,
                            renameValue.trim(),
                            asset.filename
                          );
                        } else {
                          setRenamingAsset(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (
                            renameValue.trim() &&
                            renameValue !== displayName
                          ) {
                            handleAssetRename(
                              asset.id,
                              asset.sha256,
                              renameValue.trim(),
                              asset.filename
                            );
                          } else {
                            setRenamingAsset(null);
                          }
                        } else if (e.key === "Escape") {
                          setRenamingAsset(null);
                        }
                      }}
                      autoFocus
                      className="flex-1 min-w-0 text-sm text-neutral-300 font-medium bg-neutral-800 border border-neutral-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
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
                        <span>{(asset.bytes / 1024 / 1024).toFixed(2)} MB</span>
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
                        onLinkAsset(asset);
                      }}
                      className="flex-shrink-0 p-1.5 text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
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
      {assetContextMenu && (
        <>
          {/* Backdrop to close menu */}
          <div className="fixed inset-0 z-40" onClick={handleClickOutside} />

          {/* Menu */}
          <div
            className="fixed z-50 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: assetContextMenu.x, top: assetContextMenu.y }}
          >
            <button
              onClick={() => {
                setRenamingAsset(assetContextMenu.asset.id);
                setRenameValue(getDisplayName(assetContextMenu.asset.filename));
                setAssetContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              Rename
            </button>
            <button
              onClick={() => {
                onMoveToInbox(assetContextMenu.asset.id);
                setAssetContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              Move to inbox
            </button>
            <button
              onClick={() => {
                if (pendingDelete === assetContextMenu.asset.id) {
                  handleAssetDelete(
                    assetContextMenu.asset.id,
                    assetContextMenu.asset.sha256
                  );
                  setAssetContextMenu(null);
                } else {
                  setPendingDelete(assetContextMenu.asset.id);
                }
              }}
              className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                pendingDelete === assetContextMenu.asset.id
                  ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
                  : "text-red-500 hover:bg-neutral-700"
              }`}
            >
              {pendingDelete === assetContextMenu.asset.id
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
          title={viewingMarkdown.asset.filename || "Markdown Preview"}
          sha256={viewingMarkdown.asset.sha256}
          onClose={() => setViewingMarkdown(null)}
          onSaved={(newHash) => {
            // Update the viewing markdown with new hash
            setViewingMarkdown((prev) =>
              prev
                ? { ...prev, asset: { ...prev.asset, sha256: newHash } }
                : null
            );
            // Trigger a refresh of the assets list
            queryClient.invalidateQueries({ queryKey: ["unlinkedAssets"] });
          }}
        />
      )}
    </div>
  );
}
