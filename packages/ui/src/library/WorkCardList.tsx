/**
 * WorkCardList Component (Platform-agnostic)
 * Compact list view without thumbnail, horizontal layout
 * Best for scanning many works quickly
 * Uses Electric hooks directly for all data fetching
 */

import { Star, Users, Calendar, FileText, Building } from "lucide-react";
import type { Work, Asset, BlobWithMetadata } from "@deeprecall/core";
import { useState, useMemo } from "react";
import {
  useAuthorsByIds,
  useDeleteWork,
  usePresets,
} from "@deeprecall/data/hooks";
import { useReaderUI } from "@deeprecall/data/stores";
import { assetsElectric } from "@deeprecall/data/repos";
import { getPrimaryAuthors, getDisplayYear } from "../utils/library";
import { WorkContextMenu } from "./WorkContextMenu";
import { EditWorkDialog } from "./EditWorkDialog";
import { BibtexExportModal } from "./BibtexExportModal";
import { logger } from "@deeprecall/telemetry";

// Platform-specific operations interface
export interface WorkCardListOperations {
  navigate: (path: string) => void;
  getBlobUrl: (sha256: string) => string;
}

// Extended work with assets
interface WorkWithAssets extends Work {
  assets?: Asset[];
}

interface WorkCardListProps {
  work: WorkWithAssets;
  onClick?: () => void;
  operations: WorkCardListOperations;
}

export function WorkCardList({ work, onClick, operations }: WorkCardListProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [droppedBlob, setDroppedBlob] = useState<BlobWithMetadata | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Electric hooks for data
  const { data: authorEntities = [] } = useAuthorsByIds(work.authorIds || []);
  const { data: allPresets = [] } = usePresets();
  const deleteWorkMutation = useDeleteWork();
  const { openTab, setLeftSidebarView } = useReaderUI();

  // Compute display values
  const authors = useMemo(
    () => getPrimaryAuthors(authorEntities, 3),
    [authorEntities]
  );
  const year = useMemo(() => getDisplayYear(work), [work]);
  const assetCount = work.assets?.length || 0;
  const journal = work.journal;

  // Find the preset for this work
  const preset = work.presetId
    ? allPresets.find((p) => p.id === work.presetId)
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
    operations.navigate("/reader");
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

  const handleDropAsset = async (assetId: string) => {
    try {
      await assetsElectric.updateAsset(assetId, { workId: work.id });
      logger.info("ui", "Asset linked to work successfully", {
        assetId,
        workId: work.id,
        workTitle: work.title,
      });
    } catch (error) {
      logger.error("ui", "Failed to link asset to work", {
        error,
        assetId,
        workId: work.id,
      });
      alert("Failed to link asset to work");
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const blobData = e.dataTransfer.getData("application/x-deeprecall-blob");
    const assetId = e.dataTransfer.getData("application/x-asset-id");

    if (assetId) {
      await handleDropAsset(assetId);
    } else if (blobData) {
      try {
        const blob = JSON.parse(blobData) as BlobWithMetadata;
        setDroppedBlob(blob);
      } catch (error) {
        logger.error("ui", "Failed to parse dropped blob data", { error });
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

      {/* Link dialog - TODO: LinkBlobDialog needs full optimization separately */}
      {droppedBlob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-neutral-900 p-6 rounded-lg border border-neutral-700 max-w-md">
            <h3 className="text-lg font-semibold text-neutral-100 mb-4">
              Link File to Work
            </h3>
            <p className="text-sm text-neutral-400 mb-4">
              File dropped: {droppedBlob.filename || droppedBlob.sha256}
            </p>
            <p className="text-sm text-neutral-400 mb-6">
              LinkBlobDialog needs separate optimization. For now, use
              drag-and-drop from UnlinkedAssetsList.
            </p>
            <button
              onClick={() => setDroppedBlob(null)}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      {isEditDialogOpen && (
        <EditWorkDialog
          work={work}
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onSuccess={() => {
            setIsEditDialogOpen(false);
          }}
          getBlobUrl={operations.getBlobUrl}
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
