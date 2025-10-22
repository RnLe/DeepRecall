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
import { SimplePDFViewer } from "../reader/SimplePDFViewer";
import type { BlobWithMetadata } from "@deeprecall/core/schemas/blobs";
import { PDFThumbnail } from "./PDFThumbnail";

interface WorkCardDetailedProps {
  work: WorkExtended;
  onClick?: () => void;
}

export function WorkCardDetailed({ work, onClick }: WorkCardDetailedProps) {
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
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);

  // Get journal and publisher from work
  const journal = work.journal;
  const publisher = work.publisher;

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
        className={`group relative bg-neutral-900/50 border rounded-xl transition-all duration-200 cursor-pointer ${
          isDragOver
            ? "border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-500/20"
            : "border-neutral-800/50 hover:border-neutral-700 hover:bg-neutral-900/80"
        }`}
      >
        <div className="flex overflow-hidden rounded-xl">
          {/* Thumbnail Area - Left Side (A4 ratio: ~1:1.41) - Borderless, touches edges */}
          <div
            className="flex-shrink-0 w-32 bg-neutral-800/50 flex items-center justify-center relative overflow-hidden cursor-pointer hover:bg-neutral-700/50 transition-colors"
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
                width={128}
                className="w-full h-full"
              />
            ) : (
              <BookOpen className="w-8 h-8 text-neutral-600" />
            )}
          </div>

          {/* Content Area - Right Side */}
          <div className="flex-1 min-w-0 flex flex-col p-3">
            {/* Action buttons - top right */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              {work.favorite && (
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
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

            {/* Preset Label + Title */}
            <div className="mb-1 pr-10">
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
              <h3 className="inline font-bold text-sm text-neutral-100 leading-tight line-clamp-1">
                {work.title}
              </h3>
            </div>

            {/* Subtitle */}
            {work.subtitle && (
              <p className="text-xs text-neutral-400 line-clamp-1 mb-1.5">
                {work.subtitle}
              </p>
            )}

            {/* Authors, Year, Journal/Publisher - Compact */}
            <div className="text-xs text-neutral-400 space-y-0.5 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Users className="w-3 h-3 flex-shrink-0 text-neutral-500" />
                <span className="line-clamp-1">{authors}</span>
                {year && (
                  <>
                    <span className="text-neutral-600">·</span>
                    <span className="flex-shrink-0">{year}</span>
                  </>
                )}
              </div>
              {(journal || publisher) && (
                <div className="flex items-center gap-1.5">
                  <Building className="w-3 h-3 flex-shrink-0 text-neutral-500" />
                  <span className="line-clamp-1">{journal || publisher}</span>
                </div>
              )}
            </div>

            {/* Topics */}
            {work.topics && work.topics.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {work.topics.slice(0, 3).map((topic) => (
                  <span
                    key={topic}
                    className="px-1.5 py-0.5 text-[10px] bg-neutral-800/50 text-neutral-400 rounded border border-neutral-700/50"
                  >
                    {topic}
                  </span>
                ))}
                {work.topics.length > 3 && (
                  <span className="text-[10px] text-neutral-500">
                    +{work.topics.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Footer - Stats */}
            <div className="mt-auto flex items-center gap-3 text-[10px] text-neutral-500 pt-1 border-t border-neutral-800/30">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                {assetCount} {assetCount === 1 ? "file" : "files"}
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

      {/* PDF Preview */}
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
