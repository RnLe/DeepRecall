/**
 * WorkCardDetailed Component
 * Large, detailed view with thumbnail and full metadata
 * Best for browsing and exploring works
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
import { usePresets } from "@/src/hooks/usePresets";
import { useState } from "react";
import { LinkBlobDialog } from "./LinkBlobDialog";
import { WorkContextMenu } from "./WorkContextMenu";
import type { BlobWithMetadata } from "@/src/schema/blobs";

interface WorkCardDetailedProps {
  work: WorkExtended;
  onClick?: () => void;
}

export function WorkCardDetailed({ work, onClick }: WorkCardDetailedProps) {
  const authors = getPrimaryAuthors(work, 3);
  const year = getDisplayYear(work);
  const versionCount = work.versions?.length || 0;
  const assetCount =
    work.versions?.reduce((sum, v) => sum + (v.assets?.length || 0), 0) || 0;

  const deleteWorkMutation = useDeleteWork();
  const allPresets = usePresets();
  const [isDragOver, setIsDragOver] = useState(false);
  const [droppedBlob, setDroppedBlob] = useState<BlobWithMetadata | null>(null);

  // Get journal from first version
  const journal = work.versions?.[0]?.journal;
  const publisher = work.versions?.[0]?.publisher;

  // Find the preset for this work
  const preset = work.presetId
    ? allPresets?.find((p) => p.id === work.presetId)
    : null;

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
          // Context menu will be shown via the WorkContextMenu button
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
        className={`group relative bg-neutral-900/50 border rounded-xl overflow-hidden transition-all duration-200 cursor-pointer ${
          isDragOver
            ? "border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-500/20"
            : "border-neutral-800/50 hover:border-neutral-700 hover:bg-neutral-900/80"
        }`}
      >
        <div className="flex gap-4 p-5">
          {/* Thumbnail Area - Left Side */}
          <div className="flex-shrink-0 w-32 h-44 bg-neutral-800/50 rounded-lg flex items-center justify-center border border-neutral-700/50">
            <BookOpen className="w-12 h-12 text-neutral-600" />
            <div className="absolute inset-0 flex items-end justify-center pb-2">
              <span className="text-xs text-neutral-500">No thumbnail</span>
            </div>
          </div>

          {/* Content Area - Right Side */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Action buttons - top right */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              {work.favorite && (
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              )}
              <div data-context-menu-trigger>
                <WorkContextMenu workId={work.id} onDelete={handleDelete} />
              </div>
            </div>

            {/* Preset Label + Title */}
            <div className="mb-1 pr-16">
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
              <h3 className="inline font-bold text-lg text-neutral-100 leading-snug line-clamp-2">
                {work.title}
              </h3>
            </div>

            {/* Subtitle */}
            {work.subtitle && (
              <p className="text-sm text-neutral-400 line-clamp-2 mb-3">
                {work.subtitle}
              </p>
            )}

            {/* Authors */}
            <div className="flex items-center gap-2 text-sm text-neutral-300 mb-2">
              <Users className="w-4 h-4 flex-shrink-0 text-neutral-500" />
              <span className="line-clamp-1">{authors}</span>
            </div>

            {/* Year */}
            {year && (
              <div className="flex items-center gap-2 text-sm text-neutral-400 mb-2">
                <Calendar className="w-4 h-4 flex-shrink-0 text-neutral-500" />
                <span>{year}</span>
              </div>
            )}

            {/* Journal or Publisher */}
            {(journal || publisher) && (
              <div className="flex items-center gap-2 text-sm text-neutral-400 mb-3">
                <Building className="w-4 h-4 flex-shrink-0 text-neutral-500" />
                <span className="line-clamp-1">{journal || publisher}</span>
              </div>
            )}

            {/* Topics */}
            {work.topics && work.topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {work.topics.slice(0, 4).map((topic) => (
                  <span
                    key={topic}
                    className="px-2 py-0.5 text-xs bg-neutral-800/50 text-neutral-400 rounded border border-neutral-700/50"
                  >
                    {topic}
                  </span>
                ))}
                {work.topics.length > 4 && (
                  <span className="px-2 py-0.5 text-xs text-neutral-500">
                    +{work.topics.length - 4} more
                  </span>
                )}
              </div>
            )}

            {/* Footer - Stats */}
            <div className="mt-auto flex items-center gap-4 text-xs text-neutral-500 pt-2 border-t border-neutral-800/50">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                {versionCount} {versionCount === 1 ? "version" : "versions"}
              </span>
              {assetCount > 0 && (
                <span>
                  {assetCount} {assetCount === 1 ? "file" : "files"}
                </span>
              )}
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
