/**
 * WorkCardList Component (Platform-agnostic)
 * Compact list view without thumbnail, horizontal layout
 * Best for scanning many works quickly
 */

import { Star, Users, Calendar, FileText, Building } from "lucide-react";
import type { WorkExtended, BlobWithMetadata } from "@deeprecall/core";
import { useState } from "react";

interface WorkCardListProps {
  work: WorkExtended;
  onClick?: () => void;

  // Platform-specific data
  authors: string;
  year: string | null;
  presets: any[];

  // Platform-specific actions
  onDelete: () => Promise<void>;
  onDoubleClick: () => void;
  onEdit: () => void;
  onExportBibtex: () => void;
  onDropBlob: (blob: BlobWithMetadata) => void;
  onDropAsset: (assetId: string) => Promise<void>;
  getBlobUrl: (sha256: string) => string;

  // Platform-specific components (passed as props)
  WorkContextMenu: React.ComponentType<{
    workId: string;
    onDelete: () => void;
    onEdit: () => void;
    onExportBibtex: () => void;
  }>;
  LinkBlobDialog: React.ComponentType<{
    blob: BlobWithMetadata;
    preselectedWorkId: string;
    onSuccess: () => void;
    onCancel: () => void;
  }>;
  EditWorkDialog: React.ComponentType<{
    work: WorkExtended;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    getBlobUrl: (sha256: string) => string;
  }>;
  BibtexExportModal: React.ComponentType<{
    work: WorkExtended;
    isOpen: boolean;
    onClose: () => void;
  }>;
}

export function WorkCardList({
  work,
  onClick,
  authors,
  year,
  presets,
  onDelete,
  onDoubleClick,
  onEdit,
  onExportBibtex,
  onDropBlob,
  onDropAsset,
  getBlobUrl,
  WorkContextMenu,
  LinkBlobDialog,
  EditWorkDialog,
  BibtexExportModal,
}: WorkCardListProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [droppedBlob, setDroppedBlob] = useState<BlobWithMetadata | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const assetCount = work.assets?.length || 0;
  const journal = work.journal;

  // Find the preset for this work
  const preset = work.presetId
    ? presets?.find((p) => p.id === work.presetId)
    : null;

  const handleDelete = async () => {
    if (!confirm(`Delete "${work.title}"?`)) return;
    await onDelete();
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const blobData = e.dataTransfer.getData("application/x-deeprecall-blob");
    const assetId = e.dataTransfer.getData("application/x-asset-id");

    if (assetId) {
      await onDropAsset(assetId);
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
        onDoubleClick={onDoubleClick}
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
          }}
          getBlobUrl={getBlobUrl}
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
