/**
 * WorkCardCompact Component
 * Medium-sized view with small thumbnail and essential metadata
 * Balanced view for browsing
 */

"use client";

import { BookOpen, Star, Users, Calendar, FileText } from "lucide-react";
import type { WorkExtended } from "@/src/schema/library";
import { getPrimaryAuthors, getDisplayYear } from "@/src/utils/library";
import { useDeleteWork } from "@/src/hooks/useLibrary";
import { usePresets } from "@/src/hooks/usePresets";
import { useState } from "react";
import { LinkBlobDialog } from "./LinkBlobDialog";
import { WorkContextMenu } from "./WorkContextMenu";
import type { BlobWithMetadata } from "@/src/schema/blobs";

interface WorkCardCompactProps {
  work: WorkExtended;
  onClick?: () => void;
}

export function WorkCardCompact({ work, onClick }: WorkCardCompactProps) {
  const authors = getPrimaryAuthors(work, 2);
  const year = getDisplayYear(work);
  const versionCount = work.versions?.length || 0;

  const deleteWorkMutation = useDeleteWork();
  const allPresets = usePresets();
  const [isDragOver, setIsDragOver] = useState(false);
  const [droppedBlob, setDroppedBlob] = useState<BlobWithMetadata | null>(null);

  // Find the preset for this work
  const preset = work.presetId
    ? allPresets?.find((p) => p.id === work.presetId)
    : null;

  // Debug preset loading
  if (work.presetId && !preset && allPresets) {
    console.warn(
      `Work "${work.title}" has presetId ${work.presetId} but preset not found. Available presets:`,
      allPresets.map((p) => ({ id: p.id, name: p.name }))
    );
  }

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

    if (assetId) {
      // Handle existing asset being linked - update its versionId
      import("@/src/repo/assets")
        .then(async ({ getAsset }) => {
          const asset = await getAsset(assetId);
          if (!asset) {
            throw new Error("Asset not found");
          }

          // Get the first version of this work, or create one
          const { createVersion } = await import("@/src/repo/versions");
          const { db } = await import("@/src/db/dexie");
          let versionId: string;

          if (work.versions && work.versions.length > 0) {
            versionId = work.versions[0].id;
          } else {
            // Create a new version
            const newVersion = await createVersion({
              kind: "version",
              workId: work.id,
              versionNumber: 1,
              favorite: false,
            });
            versionId = newVersion.id;
          }

          // Update the asset to link it to this version (use raw Dexie update)
          await db.assets.update(asset.id, {
            versionId: versionId,
            updatedAt: new Date().toISOString(),
          });

          console.log("✅ Asset linked to work successfully!");
        })
        .catch((error) => {
          console.error("Failed to link asset to work:", error);
          alert("Failed to link asset to work");
        });
    } else if (blobData) {
      try {
        const blob = JSON.parse(blobData) as BlobWithMetadata;
        setDroppedBlob(blob);
      } catch (error) {
        console.error("Failed to parse dropped blob data:", error);
      }
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
        className={`group relative bg-neutral-900/50 border rounded-lg overflow-hidden transition-all duration-200 cursor-pointer ${
          isDragOver
            ? "border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-500/20"
            : "border-neutral-800/50 hover:border-neutral-700 hover:bg-neutral-900/80"
        }`}
      >
        {/* Action buttons - top right */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
          {work.favorite && (
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          )}
          <div data-context-menu-trigger>
            <WorkContextMenu workId={work.id} onDelete={handleDelete} />
          </div>
        </div>

        {/* Thumbnail - Top */}
        <div className="w-full h-24 bg-neutral-800/50 flex items-center justify-center border-b border-neutral-800/50">
          <BookOpen className="w-8 h-8 text-neutral-600" />
        </div>

        {/* Content - Bottom */}
        <div className="p-3">
          {/* Preset Label + Title */}
          <div className="mb-1 pr-8">
            {preset && (
              <span
                className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded mr-2"
                style={{
                  backgroundColor: preset.color
                    ? `${preset.color}20`
                    : "rgba(148, 163, 184, 0.2)",
                  color: preset.color || "#94a3b8",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: preset.color
                    ? `${preset.color}40`
                    : "rgba(148, 163, 184, 0.4)",
                }}
              >
                {preset.name}
              </span>
            )}
            <h3 className="inline font-semibold text-sm text-neutral-100 leading-snug line-clamp-2">
              {work.title}
            </h3>
          </div>

          {/* Authors and Year */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-2">
            <Users className="w-3 h-3 flex-shrink-0" />
            <span className="truncate flex-1">{authors}</span>
            {year && (
              <>
                <span className="text-neutral-600">·</span>
                <span className="flex-shrink-0">{year}</span>
              </>
            )}
          </div>

          {/* Topics */}
          {work.topics && work.topics.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {work.topics.slice(0, 2).map((topic) => (
                <span
                  key={topic}
                  className="px-1.5 py-0.5 text-xs bg-neutral-800/50 text-neutral-500 rounded"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-2 text-xs text-neutral-600 pt-2 border-t border-neutral-800/30">
            <FileText className="w-3 h-3" />
            <span>{versionCount}v</span>
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
