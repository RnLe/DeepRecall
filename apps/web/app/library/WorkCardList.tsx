/**
 * WorkCardList Component (Next.js wrapper)
 * Uses Electric hooks and Next.js-specific APIs
 */

"use client";

import type { WorkExtended } from "@deeprecall/core/schemas/library";
import { getPrimaryAuthors, getDisplayYear } from "@/src/utils/library";
import { useAuthors } from "@deeprecall/data/hooks/useAuthors";
import { useDeleteWork } from "@deeprecall/data/hooks/useWorks";
import { usePresets } from "@deeprecall/data/hooks/usePresets";
import { useReaderUI } from "@deeprecall/data/stores/reader-ui";
import { WorkCardList as WorkCardListUI } from "@deeprecall/ui/library/WorkCardList";
import { LinkBlobDialog } from "./LinkBlobDialog";
import { WorkContextMenu } from "./WorkContextMenu";
import { EditWorkDialog } from "./EditWorkDialog";
import { BibtexExportModal } from "./BibtexExportModal";
import { updateAsset } from "@deeprecall/data/repos/assets.electric";
import type { BlobWithMetadata } from "@deeprecall/core/schemas/blobs";

// Platform-specific navigation adapter
interface NavigationAdapter {
  navigate: (path: string) => void;
}

function useNavigation(): NavigationAdapter {
  // In Next.js, use useRouter from next/navigation
  // In other platforms, implement differently
  if (typeof window !== "undefined") {
    const { useRouter } = require("next/navigation");
    const router = useRouter();
    return {
      navigate: (path: string) => router.push(path),
    };
  }
  return {
    navigate: () => {},
  };
}

interface WorkCardListProps {
  work: WorkExtended;
  onClick?: () => void;
}

export function WorkCardList({ work, onClick }: WorkCardListProps) {
  // Get all authors and filter by IDs
  const { data: allAuthors = [] } = useAuthors();
  const authorEntities = allAuthors.filter((a) =>
    work.authorIds?.includes(a.id)
  );
  const authors = getPrimaryAuthors(authorEntities, 3);
  const year = getDisplayYear(work);

  const navigation = useNavigation();
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
    navigation.navigate("/reader");
  };

  const handleDropAsset = async (assetId: string) => {
    try {
      // Use Electric updateAsset (id, updates)
      await updateAsset(assetId, {
        workId: work.id,
      });
      console.log("✅ Asset linked to work successfully!");
    } catch (error) {
      console.error("Failed to link asset to work:", error);
      alert("Failed to link asset to work");
    }
  };

  return (
    <WorkCardListUI
      work={work}
      onClick={onClick}
      authors={authors}
      year={year}
      presets={allPresets}
      onDelete={handleDelete}
      onDoubleClick={handleDoubleClick}
      onEdit={() => {}}
      onExportBibtex={() => {}}
      onDropBlob={(blob: BlobWithMetadata) => {}}
      onDropAsset={handleDropAsset}
      getBlobUrl={(sha256) => `/api/blob/${sha256}`}
      WorkContextMenu={WorkContextMenu as any}
      LinkBlobDialog={LinkBlobDialog}
      EditWorkDialog={EditWorkDialog}
      BibtexExportModal={BibtexExportModal}
    />
  );
}
