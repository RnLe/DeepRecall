/**
 * WorkCardCompact Component
 * Medium-sized view with small thumbnail and essential metadata
 * Balanced view for browsing
 */

"use client";

import { BookOpen, Star, Users } from "lucide-react";
import type { WorkExtended } from "@deeprecall/core";
import { getPrimaryAuthors, getDisplayYear } from "@/src/utils/library";
import { useAuthorsByIds } from "@/src/hooks/useAuthors";
import { useDeleteWork } from "@/src/hooks/useLibrary";
import { usePresets } from "@/src/hooks/usePresets";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useReaderUI } from "@deeprecall/data/stores";
import { LinkBlobDialog } from "./LinkBlobDialog";
import { WorkContextMenu } from "./WorkContextMenu";
import { EditWorkDialog } from "./EditWorkDialog";
import { BibtexExportModal } from "./BibtexExportModal";
import { SimplePDFViewer } from "../reader/SimplePDFViewer";
import type { BlobWithMetadata } from "@deeprecall/core";
import { PDFThumbnail } from "./PDFThumbnail";

interface WorkCardCompactProps {
  work: WorkExtended;
  onClick?: () => void;
}

export function WorkCardCompact({ work, onClick }: WorkCardCompactProps) {
  const { data: authorEntities = [] } = useAuthorsByIds(work.authorIds || []);
  const authors = getPrimaryAuthors(authorEntities, 2);
  const year = getDisplayYear(work);
  const assetCount = work.assets?.length || 0;

  const router = useRouter();
  const { openTab, setLeftSidebarView } = useReaderUI();
  const deleteWorkMutation = useDeleteWork();
  const allPresets = usePresets();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
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
      import("@/src/repo/assets")
        .then(async ({ getAsset }) => {
          const asset = await getAsset(assetId);
          if (!asset) {
            throw new Error("Asset not found");
          }

          // Update the asset to link it directly to this work (use raw Dexie update)
          const { db } = await import("@/src/db/dexie");
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
        className={`group relative bg-neutral-900/50 border rounded-lg transition-all duration-200 cursor-pointer h-24 ${
          isDragOver
            ? "border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-500/20"
            : "border-neutral-800/50 hover:border-neutral-700 hover:bg-neutral-900/80"
        }`}
      >
        <div className="flex h-full overflow-hidden rounded-lg">
          {/* Thumbnail - Left (borderless on top, left, bottom) */}
          <div
            className="flex-shrink-0 w-16 bg-neutral-800/50 flex items-center justify-center border-r border-neutral-800/50 -ml-px -mt-px -mb-px rounded-l-lg overflow-hidden cursor-pointer hover:bg-neutral-700/50 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              if (work.assets?.[0]?.mime === "application/pdf") {
                setIsPdfPreviewOpen(true);
              }
            }}
          >
            {work.assets &&
            work.assets.length > 0 &&
            work.assets[0].mime === "application/pdf" ? (
              <PDFThumbnail
                sha256={work.assets[0].sha256}
                width={64}
                className="w-full h-full"
              />
            ) : (
              <BookOpen className="w-6 h-6 text-neutral-600" />
            )}
          </div>

          {/* Content - Right */}
          <div className="flex-1 min-w-0 p-3 flex flex-col justify-center">
            {/* Action buttons - top right */}
            <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
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
            {/* Line 1: Preset + Title */}
            <div className="mb-1 pr-12">
              {preset && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded mr-1.5"
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

            {/* Line 2: Authors, Year, Topics */}
            <div className="flex items-center gap-2 text-xs text-neutral-400 pr-12">
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <Users className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{authors}</span>
              </div>
              {year && (
                <>
                  <span className="text-neutral-600">·</span>
                  <span className="flex-shrink-0">{year}</span>
                </>
              )}
              {work.topics && work.topics.length > 0 && (
                <>
                  <span className="text-neutral-600">·</span>
                  <span className="text-[10px] text-neutral-500 flex-shrink-0">
                    {work.topics.slice(0, 2).join(", ")}
                    {work.topics.length > 2 && ` +${work.topics.length - 2}`}
                  </span>
                </>
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

      {/* BibTeX export modal */}
      <BibtexExportModal
        work={work}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      {/* PDF preview */}
      {isPdfPreviewOpen && work.assets?.[0]?.sha256 && (
        <SimplePDFViewer
          sha256={work.assets[0].sha256}
          title={work.title || "PDF Preview"}
          onClose={() => setIsPdfPreviewOpen(false)}
        />
      )}
    </>
  );
}
