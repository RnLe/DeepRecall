/**
 * WorkCardCompact Component (Platform-agnostic)
 * Medium-sized view with small thumbnail and essential metadata
 * Balanced view for browsing
 * Uses Electric hooks directly for all data fetching
 */

import { BookOpen, Star, Users } from "lucide-react";
import type { Work, Asset, BlobWithMetadata } from "@deeprecall/core";
import type { BlobCAS } from "@deeprecall/blob-storage";
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
import { SimplePDFViewer } from "../components/SimplePDFViewer";
import { PDFThumbnail } from "./PDFThumbnail";
import { BlobStatusBadge } from "./BlobStatusBadge";
import { logger } from "@deeprecall/telemetry";

// Platform-specific operations interface (minimal)
export interface WorkCardCompactOperations {
  navigate: (path: string) => void;
  getBlobUrl: (sha256: string) => string;
  cas: BlobCAS;
}

// Extended work with assets
interface WorkWithAssets extends Work {
  assets?: Asset[];
}

interface WorkCardCompactProps {
  work: WorkWithAssets;
  onClick?: () => void;
  operations: WorkCardCompactOperations;
}

export function WorkCardCompact({
  work,
  onClick,
  operations,
}: WorkCardCompactProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [droppedBlob, setDroppedBlob] = useState<BlobWithMetadata | null>(null);

  // Electric hooks for data
  const { data: authorEntities = [] } = useAuthorsByIds(work.authorIds || []);
  const { data: allPresets = [] } = usePresets();
  const deleteWorkMutation = useDeleteWork();
  const { openTab, setLeftSidebarView } = useReaderUI();

  // Compute display values
  const authors = useMemo(
    () => getPrimaryAuthors(authorEntities, 2),
    [authorEntities]
  );
  const year = useMemo(() => getDisplayYear(work), [work]);

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

  const handleDropAsset = async (assetId: string) => {
    try {
      await assetsElectric.updateAsset(assetId, { workId: work.id });
      logger.info("ui", "Asset linked to work", { assetId, workId: work.id });
    } catch (error) {
      logger.error("ui", "Failed to link asset to work", {
        error,
        assetId,
        workId: work.id,
      });
      alert("Failed to link asset to work");
    }
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
      // Handle existing asset being linked
      await handleDropAsset(assetId);
    } else if (blobData) {
      try {
        const blob = JSON.parse(blobData) as BlobWithMetadata;
        setDroppedBlob(blob);
      } catch (error) {
        logger.error("ui", "Failed to parse dropped blob data", {
          error,
          workId: work.id,
        });
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
            className="shrink-0 w-16 bg-neutral-800/50 flex items-center justify-center border-r border-neutral-800/50 -ml-px -mt-px -mb-px rounded-l-lg overflow-hidden cursor-pointer hover:bg-neutral-700/50 transition-colors"
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
                getBlobUrl={operations.getBlobUrl}
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
                <Users className="w-3 h-3 shrink-0" />
                <span className="truncate">{authors}</span>
              </div>
              {year && (
                <>
                  <span className="text-neutral-600">·</span>
                  <span className="shrink-0">{year}</span>
                </>
              )}
              {work.topics && work.topics.length > 0 && (
                <>
                  <span className="text-neutral-600">·</span>
                  <span className="text-[10px] text-neutral-500 shrink-0">
                    {work.topics.slice(0, 2).join(", ")}
                    {work.topics.length > 2 && ` +${work.topics.length - 2}`}
                  </span>
                </>
              )}
            </div>

            {/* Line 3: Blob Status (if has PDF asset) */}
            {work.assets &&
              work.assets.length > 0 &&
              work.assets[0].mime === "application/pdf" && (
                <div className="mt-0.5">
                  <BlobStatusBadge
                    sha256={work.assets[0].sha256}
                    cas={operations.cas}
                    className="text-[10px]"
                  />
                </div>
              )}
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
          getBlobUrl={operations.getBlobUrl}
        />
      )}
    </>
  );
}
