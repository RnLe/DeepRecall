/**
 * Orphaned blobs section
 * Shows files in the system that aren't linked to any works
 * Compact list view with mini thumbnails
 * Platform-agnostic - receives server blob data via props, imports LinkBlobDialog directly
 */

import { useState } from "react";
import {
  FileQuestion,
  Link,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { BlobWithMetadata } from "@deeprecall/core";
import { LinkBlobDialog } from "./LinkBlobDialog";

// Platform-specific operations interface (minimal)
export interface OrphanedBlobsOperations {
  // Server blob data (requires CAS adapter)
  orphanedBlobs: BlobWithMetadata[];
  isLoading?: boolean;
  // Platform-specific getBlobUrl for LinkBlobDialog
  getBlobUrl: (sha256: string) => string;
  syncBlobToElectric: (sha256: string) => Promise<void>;
}

interface OrphanedBlobsProps {
  operations: OrphanedBlobsOperations;
}

export function OrphanedBlobs({ operations }: OrphanedBlobsProps) {
  const { orphanedBlobs, isLoading, getBlobUrl, syncBlobToElectric } =
    operations;
  const [linkingBlob, setLinkingBlob] = useState<BlobWithMetadata | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (isLoading) {
    return null;
  }

  if (!orphanedBlobs || orphanedBlobs.length === 0) {
    return null;
  }

  const handleLinkClick = (blob: BlobWithMetadata) => {
    setLinkingBlob(blob);
  };

  return (
    <div className="border-t border-neutral-800/50 pt-8 mt-8">
      {/* Header with collapse toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <FileQuestion className="w-5 h-5 text-amber-500" />
          <div>
            <h2 className="text-lg font-semibold text-neutral-200">
              Unlinked Files
            </h2>
            <p className="text-sm text-neutral-500">
              {orphanedBlobs.length}{" "}
              {orphanedBlobs.length === 1 ? "file" : "files"} not linked to any
              work
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-lg transition-colors"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronUp className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Compact list of blobs */}
      {!isCollapsed && (
        <div className="space-y-2">
          {orphanedBlobs.map((blob) => (
            <div
              key={blob.sha256}
              draggable
              onDragStart={(e) => {
                // Store blob data in drag event
                e.dataTransfer.setData(
                  "application/x-deeprecall-blob",
                  JSON.stringify(blob)
                );
                // Also set blob ID for activity banners
                e.dataTransfer.setData("application/x-blob-id", blob.sha256);
                e.dataTransfer.effectAllowed = "link";
                // Add visual feedback
                if (e.currentTarget instanceof HTMLElement) {
                  e.currentTarget.style.opacity = "0.5";
                }
              }}
              onDragEnd={(e) => {
                // Remove visual feedback
                if (e.currentTarget instanceof HTMLElement) {
                  e.currentTarget.style.opacity = "1";
                }
              }}
              className="bg-neutral-900/30 border border-amber-900/30 rounded-lg p-3 hover:border-amber-800/50 transition-colors cursor-move"
            >
              <div className="flex items-center gap-3">
                {/* Mini thumbnail placeholder - left */}
                <div className="shrink-0 w-12 h-12 bg-neutral-800/50 rounded flex items-center justify-center border border-neutral-700/50">
                  <FileText className="w-5 h-5 text-neutral-600" />
                </div>

                {/* Filename - main */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm text-neutral-300 font-medium truncate">
                    {blob.filename}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-neutral-600 mt-0.5">
                    <span>{(blob.size / 1024 / 1024).toFixed(1)} MB</span>
                    {blob.pageCount && (
                      <>
                        <span>·</span>
                        <span>{blob.pageCount} pages</span>
                      </>
                    )}
                  </div>
                </div>

                {/* MIME type */}
                <div className="hidden md:block shrink-0 w-32">
                  <span className="text-xs text-neutral-500 truncate block">
                    {blob.mime}
                  </span>
                </div>

                {/* Link button - right */}
                <button
                  onClick={() => handleLinkClick(blob)}
                  className="shrink-0 p-2 text-amber-500 hover:bg-amber-500/10 rounded transition-colors"
                  title="Link to work"
                >
                  <Link className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link dialog */}
      {linkingBlob && (
        <LinkBlobDialog
          blob={linkingBlob}
          operations={{ getBlobUrl, syncBlobToElectric }}
          onSuccess={() => {
            setLinkingBlob(null);
            // Query will auto-refresh via React Query
          }}
          onCancel={() => setLinkingBlob(null)}
        />
      )}
    </div>
  );
}
