/**
 * FileInbox Component
 * Shows two sections side-by-side:
 * - New Files (Inbox): Orphaned blobs that have never been touched
 * - Unlinked Assets: Assets that were created but are not currently linked
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
import type { BlobWithMetadata } from "@/src/schema/blobs";
import type { Asset } from "@/src/schema/library";

export function FileInbox() {
  const queryClient = useQueryClient();
  const { data: newFiles } = useOrphanedBlobs(); // Never touched blobs (React Query)
  const unlinkedAssets = useUnlinkedAssets(); // Created but unlinked assets (useLiveQuery)
  const [linkingBlob, setLinkingBlob] = useState<BlobWithMetadata | null>(null);
  const [isNewFilesCollapsed, setIsNewFilesCollapsed] = useState(false);
  const [isUnlinkedCollapsed, setIsUnlinkedCollapsed] = useState(false);

  // Debug logging
  console.log(
    `[FileInbox] Render - newFiles:`,
    newFiles?.length || 0,
    "unlinkedAssets:",
    unlinkedAssets?.length || 0
  );

  // Log when data changes
  if (newFiles && newFiles.length > 0) {
    console.log(`[FileInbox] ✅ Has ${newFiles.length} new files:`);
    newFiles.forEach((f) => console.log(`  - ${f.filename}`));
  }

  const hasNewFiles = newFiles && newFiles.length > 0;
  const hasUnlinkedAssets = unlinkedAssets && unlinkedAssets.length > 0;

  return (
    <div className="border-t border-neutral-800/50 pt-8 mt-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* New Files (Inbox) - Left Side */}
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileQuestion className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-neutral-200">
                New Files (Inbox)
                {hasNewFiles && (
                  <span className="text-sm font-normal text-neutral-500 ml-2">
                    ({newFiles.length})
                  </span>
                )}
              </h2>
            </div>

            {hasNewFiles && (
              <button
                onClick={() => setIsNewFilesCollapsed(!isNewFilesCollapsed)}
                className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-lg transition-colors"
                title={isNewFilesCollapsed ? "Expand" : "Collapse"}
              >
                {isNewFilesCollapsed ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronUp className="w-5 h-5" />
                )}
              </button>
            )}
          </div>

          {/* Empty state */}
          {!hasNewFiles && (
            <div className="bg-neutral-800/30 border border-neutral-700/50 rounded-lg p-6 flex flex-col items-center justify-center text-center">
              <FileQuestion className="w-12 h-12 text-neutral-600 mb-3" />
              <p className="text-sm text-neutral-500">No new files</p>
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
                  className="bg-neutral-900/30 border border-amber-900/30 rounded-lg p-2.5 hover:border-amber-800/50 transition-colors cursor-move"
                >
                  <div className="flex items-center gap-2.5">
                    {/* Mini thumbnail */}
                    <div className="flex-shrink-0 w-10 h-10 bg-neutral-800/50 rounded flex items-center justify-center border border-neutral-700/50">
                      <FileText className="w-4 h-4 text-neutral-600" />
                    </div>

                    {/* Filename & size */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm text-neutral-300 font-medium truncate">
                        {blob.filename}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-600 mt-0.5">
                        <span>{(blob.size / 1024 / 1024).toFixed(1)} MB</span>
                        {blob.pageCount && (
                          <>
                            <span>·</span>
                            <span>{blob.pageCount}p</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Link button */}
                    <button
                      onClick={() => setLinkingBlob(blob)}
                      className="flex-shrink-0 p-1.5 text-amber-500 hover:bg-amber-500/10 rounded transition-colors"
                      title="Link to work"
                    >
                      <Link className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unlinked Assets - Right Side */}
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-neutral-200">
                Unlinked Assets
                {hasUnlinkedAssets && (
                  <span className="text-sm font-normal text-neutral-500 ml-2">
                    ({unlinkedAssets.length})
                  </span>
                )}
              </h2>
            </div>

            {hasUnlinkedAssets && (
              <button
                onClick={() => setIsUnlinkedCollapsed(!isUnlinkedCollapsed)}
                className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-lg transition-colors"
                title={isUnlinkedCollapsed ? "Expand" : "Collapse"}
              >
                {isUnlinkedCollapsed ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronUp className="w-5 h-5" />
                )}
              </button>
            )}
          </div>

          {/* Empty state */}
          {!hasUnlinkedAssets && (
            <div className="bg-neutral-800/30 border border-neutral-700/50 rounded-lg p-6 flex flex-col items-center justify-center text-center">
              <Package className="w-12 h-12 text-neutral-600 mb-3" />
              <p className="text-sm text-neutral-500">No unlinked assets</p>
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
                  className="bg-neutral-900/30 border border-blue-900/30 rounded-lg p-2.5 hover:border-blue-800/50 transition-colors cursor-move"
                >
                  <div className="flex items-center gap-2.5">
                    {/* Mini thumbnail */}
                    <div className="flex-shrink-0 w-10 h-10 bg-neutral-800/50 rounded flex items-center justify-center border border-neutral-700/50">
                      <FileText className="w-4 h-4 text-neutral-600" />
                    </div>

                    {/* Filename & size */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm text-neutral-300 font-medium truncate">
                        {asset.filename}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-600 mt-0.5">
                        <span>{(asset.bytes / 1024 / 1024).toFixed(1)} MB</span>
                        {asset.pageCount && (
                          <>
                            <span>·</span>
                            <span>{asset.pageCount}p</span>
                          </>
                        )}
                        <span>·</span>
                        <span className="text-blue-500">Asset</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Link dialog */}
      {linkingBlob && (
        <LinkBlobDialog
          blob={linkingBlob}
          onSuccess={() => {
            setLinkingBlob(null);
            // Invalidate orphanedBlobs (React Query for server data)
            // Note: unlinkedAssets uses useLiveQuery, so it updates automatically
            queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
            queryClient.invalidateQueries({ queryKey: ["files"] });
          }}
          onCancel={() => setLinkingBlob(null)}
        />
      )}
    </div>
  );
}
