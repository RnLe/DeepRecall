/**
 * WorkCardDetailed Wrapper (Next.js)
 * Provides Electric hooks and Next.js-specific implementations
 */

"use client";

import { WorkCardDetailed as WorkCardDetailedUI } from "@deeprecall/ui/library/WorkCardDetailed";
import type { WorkCardDetailedOperations } from "@deeprecall/ui/library/WorkCardDetailed";
import type { WorkExtended } from "@deeprecall/core";
import { getPrimaryAuthors, getDisplayYear } from "@/src/utils/library";
import { useAuthorsByIds, useDeleteWork, usePresets } from "@deeprecall/data/hooks";
import { useRouter } from "next/navigation";
import { useReaderUI } from "@deeprecall/data/stores/reader-ui";
import { updateAsset } from "@deeprecall/data/repos/assets.electric";
import { LinkBlobDialog } from "./LinkBlobDialog";
import { WorkContextMenu } from "./WorkContextMenu";
import { EditWorkDialog } from "./EditWorkDialog";
import { BibtexExportModal } from "./BibtexExportModal";
import { SimplePDFViewer } from "../reader/SimplePDFViewer";
import { PDFThumbnail } from "./PDFThumbnail";

interface WorkCardDetailedProps {
  work: WorkExtended;
  onClick?: () => void;
}

export function WorkCardDetailed({ work, onClick }: WorkCardDetailedProps) {
  const { data: authorEntities = [] } = useAuthorsByIds(work.authorIds || []);
  const authors = getPrimaryAuthors(authorEntities, 3);
  const year = getDisplayYear(work);

  const router = useRouter();
  const { openTab, setLeftSidebarView } = useReaderUI();
  const deleteWorkMutation = useDeleteWork();
  const { data: allPresets = [] } = usePresets();

  const handleDelete = async () => {
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

  const handleDropAsset = async (assetId: string) => {
    try {
      // Update the asset to link it directly to this work
      await updateAsset(assetId, {
        workId: work.id,
      });
      console.log("✅ Asset linked to work successfully!");
    } catch (error) {
      console.error("Failed to link asset to work:", error);
      alert("Failed to link asset to work");
    }
  };

  const operations: WorkCardDetailedOperations = {
    authors,
    year,
    presets: allPresets,
    onDelete: handleDelete,
    onDoubleClick: handleDoubleClick,
    onEdit: () => {},
    onExportBibtex: () => {},
    onDropAsset: handleDropAsset,
    getBlobUrl: (sha256) => `/api/blob/${sha256}`,
    onPdfPreviewClick: () => {},
    WorkContextMenu: WorkContextMenu as any,
    LinkBlobDialog,
    EditWorkDialog,
    BibtexExportModal,
    SimplePDFViewer,
    PDFThumbnail,
  };

  return <WorkCardDetailedUI work={work} onClick={onClick} operations={operations} />;
}
