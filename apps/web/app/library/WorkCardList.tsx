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
import type { WorkExtended } from "@deeprecall/core/schemas/library";
import { getPrimaryAuthors, getDisplayYear } from "@/src/utils/library";
import { useAuthorsByIds } from "@/src/hooks/useAuthors";
import { useDeleteWork } from "@/src/hooks/useLibrary";
import { usePresets } from "@/src/hooks/usePresets";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useReaderUI } from "@deeprecall/data/stores/reader-ui";
import { LinkBlobDialog } from "./LinkBlobDialog";
import { WorkContextMenu } from "./WorkContextMenu";
import { EditWorkDialog } from "./EditWorkDialog";
import { BibtexExportModal } from "./BibtexExportModal";
import type { BlobWithMetadata } from "@deeprecall/core/schemas/blobs";

interface WorkCardListProps {
  work: WorkExtended;
  onClick?: () => void;
}

export function WorkCardList({ work, onClick }: WorkCardListProps) {
  const { data: authorEntities = [] } = useAuthorsByIds(work.authorIds || []);
  const authors = getPrimaryAuthors(authorEntities, 3);
  const year = getDisplayYear(work);
  const assetCount = work.assets?.length || 0;

  const router = useRouter();
  const { openTab, setLeftSidebarView } = useReaderUI();
  const deleteWorkMutation = useDeleteWork();
  const allPresets = usePresets();
  const [isDragOver, setIsDragOver] = useState(false);
  const [droppedBlob, setDroppedBlob] = useState<BlobWithMetadata | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const journal = work.journal;

  // Find the preset for this work
  const preset = work.presetId
    ? allPresets?.find((p) => p.id === work.presetId)
    : null;

  const handleDelete = async () => {
    if (!confirm(`Delete "${work.title}"?`)) return;
    await deleteWorkMutation.mutateAsync(work.id);
  };

  const handleDoubleClick = () => {
    // Find first PDF asset
    const pdfAsset = work.assets?.find(
      (asset) => asset.mime === "application/pdf"
    );
    if (!pdfAsset) return;

    // Open in reader
    openTab(pdfAsset.sha256, work.title || pdfAsset.filename);
    setLeftSidebarView("annotations");
    router.push("/reader");
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
      // Handle existing asset being linked - update its workId
      import("@deeprecall/data/repos/assets")
        .then(async ({ getAsset }) => {
          const asset = await getAsset(assetId);
          if (!asset) {
            throw new Error("Asset not found");
          }

          // Update the asset to link it directly to this work (use raw Dexie update)
          const { db } = await import("@deeprecall/data/db");
          await db.assets.update(asset.id, {
            workId: work.id,
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
        onDoubleClick={handleDoubleClick}
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
        className={`group relative bg-neutral-900/50 border rounded-lg px-4 py-0.5 transition-all duration-200 cursor-pointer ${
          isDragOver
            ? "border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-500/20"
            : "border-neutral-800/50 hover:border-neutral-700 hover:bg-neutral-900/80"
        }`}
      >
        <div className="flex items-center gap-4">
          {/* Preset Label + Title - Main */}
          <div className="flex-1 min-w-0">
            <div>
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
              <h3 className="inline font-semibold text-sm text-neutral-100 leading-tight line-clamp-1">
                {work.title}
              </h3>
            </div>
            {work.subtitle && (
              <p className="text-xs text-neutral-500 line-clamp-1 mt-0">
                {work.subtitle}
              </p>
            )}
          </div>

          {/* Authors */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-neutral-400 shrink-0 w-48">
            <Users className="w-3 h-3" />
            <span className="truncate">{authors}</span>
          </div>

          {/* Year */}
          {year && (
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-neutral-400 shrink-0 w-20">
              <Calendar className="w-3 h-3" />
              <span>{year}</span>
            </div>
          )}

          {/* Journal */}
          {journal && (
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-neutral-500 shrink-0 w-40">
              <Building className="w-3 h-3" />
              <span className="truncate">{journal}</span>
            </div>
          )}

          {/* Assets */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-600 shrink-0">
            <FileText className="w-3 h-3" />
            <span>
              {assetCount} {assetCount === 1 ? "file" : "files"}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-neutral-500">
              <FileText className="w-3 h-3" />
              <span>{assetCount}</span>
            </div>

            {work.favorite && (
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            )}

            <div data-context-menu-trigger>
              <WorkContextMenu
                workId={work.id}
                onDelete={handleDelete}
                onEdit={() => setIsEditDialogOpen(true)}
                onExportBibtex={() => setIsExportModalOpen(true)}
              />
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

      {/* Edit dialog */}
      {isEditDialogOpen && (
        <EditWorkDialog
          work={work}
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onSuccess={() => {
            setIsEditDialogOpen(false);
            // Works will auto-refresh via useLiveQuery
          }}
        />
      )}

      {/* BibTeX Export Modal */}
      <BibtexExportModal
        work={work}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </>
  );
}
