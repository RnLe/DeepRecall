import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useWorks,
  useAssets,
  useActivities,
  useCreateEdge,
} from "@deeprecall/data/hooks";
import {
  activities as activityRepo,
  edges as edgeRepo,
  assets as assetRepo,
} from "@deeprecall/data/repos";
import type {
  WorkExtended,
  ActivityExtended,
  WorkType,
  BlobWithMetadata,
} from "@deeprecall/core";

// Pure UI imports
import {
  LibraryFilters,
  CreateWorkDialog,
  CreateActivityDialog,
  TemplateLibrary,
  type ViewMode,
} from "@deeprecall/ui";
import { useTemplateLibraryUI } from "@deeprecall/data/stores";
import { compareWorksByTitle } from "@deeprecall/ui/utils";
import { logger } from "@deeprecall/telemetry";

// Platform wrappers
import { WorkCardDetailed } from "../components/library/_components/WorkCardDetailed";
import { WorkCardCompact } from "../components/library/_components/WorkCardCompact";
import { WorkCardList } from "../components/library/_components/WorkCardList";
import { ActivityBanner } from "../components/library/_components/ActivityBanner";
import { AuthorLibrary } from "../components/library/_components/AuthorLibrary";
import { ExportDataDialog } from "../components/library/_components/ExportDataDialog";
import { ImportDataDialog } from "../components/library/_components/ImportDataDialog";
import { LibraryHeader } from "../components/library/_components/LibraryHeader";
import { LibraryLeftSidebar } from "../components/library/_components/LibraryLeftSidebar";
import { LinkBlobDialog } from "../components/library/_components/LinkBlobDialog";

export default function LibraryPage() {
  // Electric hooks - real-time synced data
  const { data: worksData, isLoading: worksLoading } = useWorks();
  const { data: assetsData } = useAssets();
  const { data: activitiesData, isLoading: activitiesLoading } =
    useActivities();
  const queryClient = useQueryClient();

  // Client-side join: Combine works with their assets
  const works = useMemo(() => {
    if (!worksData || !assetsData) return undefined;

    return worksData.map((work): WorkExtended => {
      const workAssets = assetsData.filter((asset) => asset.workId === work.id);
      return {
        ...work,
        assets: workAssets,
      };
    });
  }, [worksData, assetsData]);

  const activities = activitiesData;
  const isLoading = worksLoading || activitiesLoading;

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<WorkType | "all">("all");
  const [sortBy, setSortBy] = useState<"title" | "date" | "author">("title");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showActivities, setShowActivities] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateActivityDialogOpen, setIsCreateActivityDialogOpen] =
    useState(false);
  const [preselectedPresetId, setPreselectedPresetId] = useState<string | null>(
    null
  );
  const [linkingBlob, setLinkingBlob] = useState<BlobWithMetadata | null>(null);
  const [isDraggingOverLibrary, setIsDraggingOverLibrary] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [isUploadingToLibrary, setIsUploadingToLibrary] = useState(false);
  const [isAuthorLibraryOpen, setIsAuthorLibraryOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // Template Library UI state
  const templateLibraryUI = useTemplateLibraryUI();
  const openTemplateLibrary = templateLibraryUI.openModal;

  // Enrich activities with their contained works/assets
  const [enrichedActivities, setEnrichedActivities] = useState<
    ActivityExtended[]
  >([]);

  // Global drag end cleanup
  useEffect(() => {
    const cleanup = () => {
      setIsDraggingOverLibrary(false);
      setDragCounter(0);
    };

    document.addEventListener("dragend", cleanup);
    document.addEventListener("drop", cleanup);

    return () => {
      document.removeEventListener("dragend", cleanup);
      document.removeEventListener("drop", cleanup);
    };
  }, []);

  // Load extended activity data
  useEffect(() => {
    if (!activities) return;

    Promise.all(
      activities.map(async (activity) => {
        const extended = await activityRepo.getActivityExtended(activity.id);
        return extended || activity;
      })
    ).then(setEnrichedActivities);
  }, [activities]);

  // Handle dropping files into activity
  const handleDropFilesToActivity = async (
    activityId: string,
    files: FileList
  ) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");

      const uploadPromises = Array.from(files).map(async (file) => {
        // Upload via Tauri
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const blob = await invoke<BlobWithMetadata>("store_blob", {
          filename: file.name,
          data: Array.from(uint8Array),
        });

        const asset = await assetRepo.createAsset({
          kind: "asset",
          sha256: blob.sha256,
          filename: blob.filename || `file-${blob.sha256.substring(0, 8)}`,
          bytes: blob.size,
          mime: blob.mime,
          pageCount: blob.pageCount,
          role: "main",
          favorite: false,
        });

        await edgeRepo.addToActivity(activityId, asset.id);
        return asset;
      });

      await Promise.all(uploadPromises);

      const extended = await activityRepo.getActivityExtended(activityId);
      if (extended) {
        setEnrichedActivities((prev) =>
          prev.map((a) => (a.id === activityId ? extended : a))
        );
      }

      queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
    } catch (error) {
      logger.error("blob.upload", "Failed to upload files to activity", {
        error,
        activityId,
      });
      alert(
        `Failed to upload files: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  // Filter and sort works
  const filteredWorks = useMemo(() => {
    if (!works) return [];

    let filtered = works;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (work) =>
          work.title.toLowerCase().includes(query) ||
          work.subtitle?.toLowerCase().includes(query) ||
          work.authors?.some((a) => a.name.toLowerCase().includes(query)) ||
          work.topics.some((t) => t.toLowerCase().includes(query))
      );
    }

    // Type filter
    if (selectedType !== "all") {
      filtered = filtered.filter((work) => work.workType === selectedType);
    }

    // Favorites filter
    if (showFavoritesOnly) {
      filtered = filtered.filter((work) => work.favorite);
    }

    // Sort
    const sorted = [...filtered];
    switch (sortBy) {
      case "title":
        sorted.sort(compareWorksByTitle);
        break;
      case "author":
        sorted.sort((a, b) => {
          const aAuthor = a.authors?.length ? a.authors[0].name : "Unknown";
          const bAuthor = b.authors?.length ? b.authors[0].name : "Unknown";
          return aAuthor.localeCompare(bAuthor);
        });
        break;
      case "date":
        sorted.sort((a, b) => {
          const aYear = a.year || 0;
          const bYear = b.year || 0;
          return bYear - aYear;
        });
        break;
    }

    return sorted;
  }, [works, searchQuery, selectedType, sortBy, showFavoritesOnly]);

  // Handle drag & drop
  const handleLibraryDragEnter = (e: React.DragEvent) => {
    // Be permissive - accept anything that might be files or internal data
    // Note: files.length is often 0 during dragenter/dragover, only populated on drop
    const hasFiles = e.dataTransfer.types.includes("Files");
    const hasBlob =
      e.dataTransfer.types.includes("application/x-deeprecall-blob") ||
      e.dataTransfer.types.includes("application/x-blob-id") ||
      e.dataTransfer.types.includes("application/x-asset-id");

    logger.debug("ui", "DragEnter event", {
      types: Array.from(e.dataTransfer.types),
      hasFiles,
      hasBlob,
    });

    if (hasFiles || hasBlob) {
      e.preventDefault();
      setDragCounter((prev) => prev + 1);
      setIsDraggingOverLibrary(true);
    }
  };

  const handleLibraryDragOver = (e: React.DragEvent) => {
    // Be permissive - accept anything that might be files or internal data
    const hasFiles = e.dataTransfer.types.includes("Files");
    const hasBlob =
      e.dataTransfer.types.includes("application/x-deeprecall-blob") ||
      e.dataTransfer.types.includes("application/x-blob-id") ||
      e.dataTransfer.types.includes("application/x-asset-id");

    if (hasFiles || hasBlob) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy"; // Changed from "link" to "copy" for better UX
    }
  };

  const handleLibraryDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    const relatedTarget = e.relatedTarget as Node | null;
    const currentTarget = e.currentTarget as Node;

    if (relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }

    if (!relatedTarget) {
      setDragCounter(0);
      setIsDraggingOverLibrary(false);
      return;
    }

    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount <= 0) {
        setIsDraggingOverLibrary(false);
        return 0;
      }
      return newCount;
    });
  };

  const handleLibraryDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverLibrary(false);
    setDragCounter(0);

    logger.debug("ui", "Drop event triggered", {
      types: Array.from(e.dataTransfer.types),
      filesCount: e.dataTransfer.files.length,
    });

    // Try to get blob data from sidebar
    const blobJson = e.dataTransfer.getData("application/x-deeprecall-blob");
    if (blobJson) {
      try {
        const blob = JSON.parse(blobJson) as BlobWithMetadata;
        setLinkingBlob(blob);
        return;
      } catch (error) {
        logger.error("ui", "Failed to parse dropped blob", { error });
      }
    }

    // Handle external file drops (Tauri)
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      logger.info("blob.upload", "Processing dropped files", {
        count: files.length,
      });
      if (files.length === 1) {
        setIsUploadingToLibrary(true);
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const file = files[0];
          logger.debug("blob.upload", "Uploading file", {
            filename: file.name,
            size: file.size,
          });
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          const result = await invoke<BlobWithMetadata>("store_blob", {
            filename: file.name,
            data: Array.from(uint8Array),
          });

          logger.info("blob.upload", "File upload successful", {
            sha256: result.sha256,
          });
          queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
          setLinkingBlob(result);
        } catch (error) {
          logger.error("blob.upload", "File upload failed", { error });
          alert(
            `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        } finally {
          setIsUploadingToLibrary(false);
        }
      } else {
        // Multiple files
        setIsUploadingToLibrary(true);
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const uploadPromises = Array.from(files).map(async (file) => {
            logger.debug("blob.upload", "Uploading file", {
              filename: file.name,
              size: file.size,
            });
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            return await invoke<BlobWithMetadata>("store_blob", {
              filename: file.name,
              data: Array.from(uint8Array),
            });
          });

          const results = await Promise.all(uploadPromises);
          logger.info("blob.upload", "All uploads successful", {
            count: results.length,
          });
          queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
        } catch (error) {
          logger.error("blob.upload", "File upload failed", { error });
          alert(
            `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        } finally {
          setIsUploadingToLibrary(false);
        }
      }
    } else {
      logger.debug("ui", "No files detected in drop event");
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Sidebar */}
      <LibraryLeftSidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Fixed Header */}
        <div className="shrink-0">
          <div className="max-w-7xl mx-auto px-8 py-4">
            <LibraryHeader
              onCreateActivity={() => setIsCreateActivityDialogOpen(true)}
              onCreateWork={() => setIsCreateDialogOpen(true)}
              onOpenTemplates={openTemplateLibrary}
              onOpenAuthors={() => setIsAuthorLibraryOpen(true)}
              onExportData={() => setIsExportDialogOpen(true)}
              onImportData={() => setIsImportDialogOpen(true)}
            />
          </div>
        </div>

        {/* Scrollable Content with Drop Zone */}
        <div
          className="flex-1 overflow-y-auto relative"
          onDragEnter={handleLibraryDragEnter}
          onDragOver={handleLibraryDragOver}
          onDragLeave={handleLibraryDragLeave}
          onDrop={handleLibraryDrop}
        >
          {isDraggingOverLibrary && (
            <div className="absolute inset-0 bg-blue-500/5 pointer-events-none z-0" />
          )}

          {isUploadingToLibrary && (
            <div className="absolute inset-0 bg-neutral-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-neutral-800 border border-neutral-700 rounded-lg px-6 py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                <p className="text-sm font-medium text-neutral-200">
                  Uploading files...
                </p>
              </div>
            </div>
          )}

          <div className="max-w-7xl mx-auto p-8 space-y-6 relative z-10">
            <LibraryFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedType={selectedType}
              onTypeChange={setSelectedType}
              sortBy={sortBy}
              onSortChange={setSortBy}
              showFavoritesOnly={showFavoritesOnly}
              onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              showActivities={showActivities}
              onToggleActivities={() => setShowActivities(!showActivities)}
            />

            {/* Activity Banners */}
            {showActivities && enrichedActivities.length > 0 && (
              <div className="space-y-4 mb-8">
                {enrichedActivities.map((activity) => (
                  <ActivityBanner
                    key={activity.id}
                    activity={activity}
                    onDropFiles={(activityId: string, files: FileList) =>
                      handleDropFilesToActivity(activityId, files)
                    }
                  />
                ))}
              </div>
            )}

            {/* Works Display */}
            <div
              className={`transition-all duration-200 ${
                isDraggingOverLibrary ? "scale-95 opacity-90" : ""
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-neutral-400">Loading library...</div>
                </div>
              ) : filteredWorks.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-neutral-400">No works found</p>
                  <button
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="mt-4 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Create your first work
                  </button>
                </div>
              ) : viewMode === "detailed" ? (
                <div className="space-y-6">
                  {filteredWorks.map((work) => (
                    <WorkCardDetailed key={work.id} work={work} />
                  ))}
                </div>
              ) : viewMode === "compact" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filteredWorks.map((work) => (
                    <WorkCardCompact key={work.id} work={work} />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredWorks.map((work) => (
                    <WorkCardList key={work.id} work={work} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <CreateWorkDialog
        isOpen={isCreateDialogOpen}
        preselectedPresetId={preselectedPresetId}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setPreselectedPresetId(null);
        }}
        onSuccess={() => {
          setIsCreateDialogOpen(false);
          setPreselectedPresetId(null);
        }}
      />

      <CreateActivityDialog
        isOpen={isCreateActivityDialogOpen}
        onClose={() => setIsCreateActivityDialogOpen(false)}
        onSuccess={() => {
          setIsCreateActivityDialogOpen(false);
        }}
      />

      {linkingBlob && (
        <LinkBlobDialog
          blob={linkingBlob}
          onSuccess={() => {
            setLinkingBlob(null);
            queryClient.invalidateQueries({ queryKey: ["works", "merged"] });
            queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
          }}
          onCancel={() => setLinkingBlob(null)}
        />
      )}

      <TemplateLibrary />

      <AuthorLibrary
        isOpen={isAuthorLibraryOpen}
        onClose={() => setIsAuthorLibraryOpen(false)}
      />

      <ExportDataDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
      />

      <ImportDataDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
      />
    </div>
  );
}
