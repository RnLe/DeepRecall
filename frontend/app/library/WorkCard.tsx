/**
 * Work card component
 * Displays a single work with its metadata in a card format
 */

"use client";

import { BookOpen, FileText, Star, Users, Trash2 } from "lucide-react";
import type { WorkExtended } from "@/src/schema/library";
import { getPrimaryAuthors, getDisplayYear } from "@/src/utils/library";
import { useDeleteWork } from "@/src/hooks/useLibrary";
import { useState } from "react";
import { LinkBlobDialog } from "./LinkBlobDialog";
import type { BlobWithMetadata } from "@/src/schema/blobs";

interface WorkCardProps {
  work: WorkExtended;
  onClick?: () => void;
}

export function WorkCard({ work, onClick }: WorkCardProps) {
  const authors = getPrimaryAuthors(work, 2);
  const year = getDisplayYear(work);
  const versionCount = work.versions?.length || 0;
  const assetCount =
    work.versions?.reduce((sum, v) => sum + (v.assets?.length || 0), 0) || 0;

  // Get preset info from metadata
  const presetName = work.metadata?._presetName as string | undefined;

  const deleteWorkMutation = useDeleteWork();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [droppedBlob, setDroppedBlob] = useState<BlobWithMetadata | null>(null);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000); // Auto-reset after 3s
      return;
    }

    console.log("Deleting work:", work.id, work.title);
    try {
      await deleteWorkMutation.mutateAsync(work.id);
      console.log("✅ Work deleted successfully");
    } catch (error) {
      console.error("❌ Failed to delete work:", error);
      alert(
        `Failed to delete work: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      setShowDeleteConfirm(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("application/x-deeprecall-blob")) {
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
    if (blobData) {
      try {
        const blob = JSON.parse(blobData) as BlobWithMetadata;
        setDroppedBlob(blob);
      } catch (error) {
        console.error("Failed to parse dropped blob data:", error);
      }
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "link";
    e.dataTransfer.setData("application/x-work-id", work.id);
  };

  return (
    <>
      <div
        onClick={onClick}
        draggable={true}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group relative bg-neutral-900/50 border rounded-lg p-5 transition-all duration-200 cursor-pointer ${
          isDragOver
            ? "border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-500/20"
            : "border-neutral-800/50 hover:border-neutral-700 hover:bg-neutral-900/80"
        }`}
      >
        {/* Action buttons - top right */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {/* Favorite indicator */}
          {work.favorite && (
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          )}

          {/* Delete button (visible on hover) */}
          <button
            onClick={handleDelete}
            onMouseLeave={() => setShowDeleteConfirm(false)}
            className={`opacity-0 group-hover:opacity-100 p-1.5 rounded transition-all ${
              showDeleteConfirm
                ? "bg-red-500 text-white"
                : "bg-neutral-800 text-neutral-400 hover:bg-red-500 hover:text-white"
            }`}
            title={showDeleteConfirm ? "Click again to confirm" : "Delete work"}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Work type icon */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0">
            <BookOpen className="w-5 h-5 text-neutral-400 group-hover:text-neutral-300 transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-neutral-100 leading-snug mb-1 line-clamp-2">
              {work.title}
            </h3>
            {work.subtitle && (
              <p className="text-sm text-neutral-500 line-clamp-1 mb-2">
                {work.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Authors and year */}
        <div className="flex items-center gap-2 text-sm text-neutral-400 mb-3">
          <Users className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{authors}</span>
          {year && <span className="text-neutral-600">·</span>}
          {year && <span className="flex-shrink-0">{year}</span>}
        </div>

        {/* Preset badge (if available) */}
        {presetName && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-900/20 text-blue-400 rounded border border-blue-900/30">
              <FileText className="w-3 h-3" />
              {presetName}
            </span>
          </div>
        )}

        {/* Work type and metadata */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-neutral-800/50 text-neutral-400 rounded">
              {work.workType}
            </span>
            {work.topics.length > 0 && (
              <span className="text-neutral-600">
                {work.topics.length} topic{work.topics.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-neutral-500">
            {versionCount > 0 && (
              <span
                className="flex items-center gap-1"
                title={`${versionCount} version(s), ${assetCount} file(s)`}
              >
                <FileText className="w-3 h-3" />
                {versionCount}v · {assetCount}f
              </span>
            )}
          </div>
        </div>

        {/* Topics (first few) */}
        {work.topics.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            {work.topics.slice(0, 3).map((topic) => (
              <span
                key={topic}
                className="text-xs px-2 py-0.5 bg-neutral-800/30 text-neutral-500 rounded"
              >
                {topic}
              </span>
            ))}
            {work.topics.length > 3 && (
              <span className="text-xs text-neutral-600">
                +{work.topics.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Drag indicator overlay */}
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-950/30 rounded-lg backdrop-blur-sm pointer-events-none">
            <div className="text-center">
              <FileText className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-blue-300">
                Drop file to link to this work
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Link dialog - opened when file is dropped */}
      {droppedBlob && (
        <LinkBlobDialog
          blob={droppedBlob}
          preselectedWorkId={work.id}
          onSuccess={() => {
            setDroppedBlob(null);
            // Query will auto-refresh via React Query
          }}
          onCancel={() => setDroppedBlob(null)}
        />
      )}
    </>
  );
}
