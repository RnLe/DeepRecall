/**
 * WorkCardList Component
 * Compact list view without thumbnail, horizontal layout
 * Best for scanning many works quickly
 */

"use client";

import {
  BookOpen,
  Star,
  Users,
  Calendar,
  FileText,
  Building,
} from "lucide-react";
import type { WorkExtended } from "@/src/schema/library";
import { getPrimaryAuthors, getDisplayYear } from "@/src/utils/library";
import { useDeleteWork } from "@/src/hooks/useLibrary";
import { useState } from "react";
import { LinkBlobDialog } from "./LinkBlobDialog";
import { WorkContextMenu } from "./WorkContextMenu";
import type { BlobWithMetadata } from "@/src/schema/blobs";

interface WorkCardListProps {
  work: WorkExtended;
  onClick?: () => void;
}

export function WorkCardList({ work, onClick }: WorkCardListProps) {
  const authors = getPrimaryAuthors(work, 2);
  const year = getDisplayYear(work);
  const versionCount = work.versions?.length || 0;

  const deleteWorkMutation = useDeleteWork();
  const [isDragOver, setIsDragOver] = useState(false);
  const [droppedBlob, setDroppedBlob] = useState<BlobWithMetadata | null>(null);

  // Get journal from first version
  const journal = work.versions?.[0]?.journal;

  const handleDelete = async () => {
    await deleteWorkMutation.mutateAsync(work.id);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "link";
    e.dataTransfer.setData("application/x-work-id", work.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      e.dataTransfer.types.includes("application/x-deeprecall-blob") ||
      e.dataTransfer.types.includes("application/x-asset-id")
    ) {
      e.dataTransfer.dropEffect = "link";
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const blobData = e.dataTransfer.getData("application/x-deeprecall-blob");
    const assetId = e.dataTransfer.getData("application/x-asset-id");

    if (blobData) {
      try {
        const blob = JSON.parse(blobData) as BlobWithMetadata;
        setDroppedBlob(blob);
      } catch (error) {
        console.error("Failed to parse dropped blob data:", error);
      }
    } else if (assetId) {
      import("@/src/repo/assets")
        .then(({ getAsset }) => getAsset(assetId))
        .then((asset) => {
          if (!asset) {
            throw new Error("Asset not found");
          }
          const pseudoBlob: BlobWithMetadata = {
            sha256: asset.sha256,
            filename: asset.filename,
            size: asset.bytes,
            mime: asset.mime,
            pageCount: asset.pageCount,
            mtime_ms: Date.now(),
            created_ms: Date.now(),
            path: null,
          };
          setDroppedBlob(pseudoBlob);
        })
        .catch((error) => {
          console.error("Failed to fetch asset data:", error);
          alert("Failed to link asset to work");
        });
    }
  };

  return (
    <>
      <div
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const menuButton = e.currentTarget.querySelector(
            "[data-context-menu-trigger]"
          ) as HTMLButtonElement;
          menuButton?.click();
        }}
        draggable={true}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group relative bg-neutral-900/50 border rounded-lg p-3 transition-all duration-200 cursor-pointer ${
          isDragOver
            ? "border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-500/20"
            : "border-neutral-800/50 hover:border-neutral-700 hover:bg-neutral-900/80"
        }`}
      >
        <div className="flex items-center gap-4">
          {/* Icon - Left */}
          <div className="flex-shrink-0">
            <BookOpen className="w-5 h-5 text-neutral-500" />
          </div>

          {/* Title - Main */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-neutral-100 leading-tight line-clamp-1">
              {work.title}
            </h3>
            {work.subtitle && (
              <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">
                {work.subtitle}
              </p>
            )}
          </div>

          {/* Authors */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-neutral-400 flex-shrink-0 w-48">
            <Users className="w-3 h-3" />
            <span className="truncate">{authors}</span>
          </div>

          {/* Year */}
          {year && (
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-neutral-400 flex-shrink-0 w-20">
              <Calendar className="w-3 h-3" />
              <span>{year}</span>
            </div>
          )}

          {/* Journal */}
          {journal && (
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-neutral-500 flex-shrink-0 w-40">
              <Building className="w-3 h-3" />
              <span className="truncate">{journal}</span>
            </div>
          )}

          {/* Versions */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-600 flex-shrink-0">
            <FileText className="w-3 h-3" />
            <span>{versionCount}v</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-neutral-500">
              <FileText className="w-3 h-3" />
              <span>{versionCount}</span>
            </div>

            {work.favorite && (
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            )}

            <div data-context-menu-trigger>
              <WorkContextMenu workId={work.id} onDelete={handleDelete} />
            </div>
          </div>
        </div>
      </div>

      {/* Link dialog */}
      {droppedBlob && (
        <LinkBlobDialog
          blob={droppedBlob}
          preselectedWorkId={work.id}
          onSuccess={() => setDroppedBlob(null)}
          onCancel={() => setDroppedBlob(null)}
        />
      )}
    </>
  );
}
