"use client";

import { useState, useMemo, useEffect } from "react";
import {
  useWorksExtended,
  useActivities,
  useCreateEdge,
} from "@/src/hooks/useLibrary";
import { useQueryClient } from "@tanstack/react-query";
import { WorkCardDetailed } from "./WorkCardDetailed";
import { WorkCardCompact } from "./WorkCardCompact";
import { WorkCardList } from "./WorkCardList";
import { LibraryHeader } from "./LibraryHeader";
import { LibraryFilters, type ViewMode } from "./LibraryFilters";
import { LibraryLeftSidebar } from "./LibraryLeftSidebar";
import { CreateWorkDialog } from "./CreateWorkDialog";
import { CreateActivityDialog } from "./CreateActivityDialog";
import { ActivityBanner } from "./ActivityBanner";
import { TemplateLibrary } from "./TemplateLibrary";
import { BookOpen, Link2 } from "lucide-react";
import type {
  WorkType,
  WorkExtended,
  ActivityExtended,
} from "@/src/schema/library";
import { compareWorksByTitle, compareWorksByDate } from "@/src/utils/library";
import { LinkBlobDialog } from "./LinkBlobDialog";
import * as activityRepo from "@/src/repo/activities";
import * as edgeRepo from "@/src/repo/edges";
import "@/src/utils/admin"; // Exposes window.cleanupDuplicatePresets()
import type { BlobWithMetadata } from "@/src/schema/blobs";
import { useTemplateLibraryUI } from "@/src/stores/template-library-ui";

export default function LibraryPage() {
  const works = useWorksExtended();
  const activities = useActivities();
  const createEdgeMutation = useCreateEdge();
  const queryClient = useQueryClient();
  // useLiveQuery returns undefined during initial load, then returns the actual data
  const isLoading = works === undefined;
  const error = null; // useLiveQuery doesn't expose errors directly

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

  // Template Library UI state from Zustand
  const openTemplateLibrary = useTemplateLibraryUI((state) => state.openModal);

  const handleCreateWorkWithPreset = (presetId: string) => {
    setPreselectedPresetId(presetId);
    setIsCreateDialogOpen(true);
  };

  // Enrich activities with their contained works/assets
  const [enrichedActivities, setEnrichedActivities] = useState<
    ActivityExtended[]
  >([]);

  // Global drag end cleanup - catches when drag ends anywhere
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
  useMemo(() => {
    if (!activities) return;

    Promise.all(
      activities.map(async (activity) => {
        const extended = await activityRepo.getActivityExtended(activity.id);
        return extended || activity;
      })
    ).then(setEnrichedActivities);
  }, [activities]);

  // Handle dropping work/blob into activity
  const handleDropWorkToActivity = async (
    activityId: string,
    workId: string
  ) => {
    try {
      await edgeRepo.addToActivity(activityId, workId);
      // Refresh activities
      const extended = await activityRepo.getActivityExtended(activityId);
      if (extended) {
        setEnrichedActivities((prev) =>
          prev.map((a) => (a.id === activityId ? extended : a))
        );
      }
    } catch (error) {
      console.error("Failed to link work to activity:", error);
      alert("Failed to link work to activity");
    }
  };

  const handleDropBlobToActivity = async (
    activityId: string,
    blobId: string
  ) => {
    try {
      // Fetch blob metadata from server
      const response = await fetch(`/api/library/metadata/${blobId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch blob metadata");
      }
      const blob = await response.json();

      // Create a standalone asset from the blob (no workId)
      const { createAsset } = await import("@/src/repo/assets");
      const asset = await createAsset({
        kind: "asset",
        sha256: blob.sha256,
        filename: blob.filename || `file-${blob.sha256.substring(0, 8)}`,
        bytes: blob.size,
        mime: blob.mime,
        pageCount: blob.pageCount,
        role: "main",
        favorite: false,
      });

      // Link the asset to the activity
      await edgeRepo.addToActivity(activityId, asset.id);

      // Refresh activities
      const extended = await activityRepo.getActivityExtended(activityId);
      if (extended) {
        setEnrichedActivities((prev) =>
          prev.map((a) => (a.id === activityId ? extended : a))
        );
      }

      // Invalidate orphanedBlobs (React Query for server data)
      // Note: unlinkedAssets uses useLiveQuery now, so it updates automatically
      queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
    } catch (error) {
      console.error("Failed to link blob to activity:", error);
      alert("Failed to link file to activity");
    }
  };

  const handleDropAssetToActivity = async (
    activityId: string,
    assetId: string
  ) => {
    try {
      // Asset already exists, just link it to the activity
      await edgeRepo.addToActivity(activityId, assetId);

      // Refresh activities
      const extended = await activityRepo.getActivityExtended(activityId);
      if (extended) {
        setEnrichedActivities((prev) =>
          prev.map((a) => (a.id === activityId ? extended : a))
        );
      }

      // Note: unlinkedAssets uses useLiveQuery, so it updates automatically when edges change
    } catch (error) {
      console.error("Failed to link asset to activity:", error);
      alert("Failed to link asset to activity");
    }
  };

  // Defensive: if a component accidentally calls blob+asset for same drop,
  // prefer the asset edge (no duplicate asset creation). Consumers should
  // call only one, but this ensures safety under race conditions.

  const handleUnlinkWorkFromActivity = async (
    activityId: string,
    workId: string
  ) => {
    try {
      await edgeRepo.removeFromActivity(activityId, workId);
      // Refresh activities
      const extended = await activityRepo.getActivityExtended(activityId);
      if (extended) {
        setEnrichedActivities((prev) =>
          prev.map((a) => (a.id === activityId ? extended : a))
        );
      }
    } catch (error) {
      console.error("Failed to unlink work from activity:", error);
      alert("Failed to unlink work from activity");
    }
  };

  const handleUnlinkAssetFromActivity = async (
    activityId: string,
    assetId: string
  ) => {
    try {
      await edgeRepo.removeFromActivity(activityId, assetId);
      // Refresh activities
      const extended = await activityRepo.getActivityExtended(activityId);
      if (extended) {
        setEnrichedActivities((prev) =>
          prev.map((a) => (a.id === activityId ? extended : a))
        );
      }

      // Note: unlinkedAssets uses useLiveQuery, so it updates automatically when edges are removed
    } catch (error) {
      console.error("Failed to unlink asset from activity:", error);
      alert("Failed to unlink file from activity");
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
          work.authors.some((a) => a.name.toLowerCase().includes(query)) ||
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
          const aAuthor = a.authors.length > 0 ? a.authors[0].name : "Unknown";
          const bAuthor = b.authors.length > 0 ? b.authors[0].name : "Unknown";
          return aAuthor.localeCompare(bAuthor);
        });
        break;
      case "date":
        sorted.sort((a, b) => {
          // Sort by work year
          const aYear = a.year || 0;
          const bYear = b.year || 0;

          return bYear - aYear; // Descending (newest first)
        });
        break;
    }

    return sorted;
  }, [works, searchQuery, selectedType, sortBy, showFavoritesOnly]);

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4">
          <p className="text-red-400">Error loading library: {String(error)}</p>
        </div>
      </div>
    );
  }

  // Handle drag & drop of assets onto library area
  const handleLibraryDragEnter = (e: React.DragEvent) => {
    // Check if we have blob or asset data
    if (
      e.dataTransfer.types.includes("application/x-deeprecall-blob") ||
      e.dataTransfer.types.includes("application/x-blob-id") ||
      e.dataTransfer.types.includes("application/x-asset-id")
    ) {
      e.preventDefault();
      setDragCounter((prev) => prev + 1);
      setIsDraggingOverLibrary(true);
    }
  };

  const handleLibraryDragOver = (e: React.DragEvent) => {
    // Check if we have blob or asset data
    if (
      e.dataTransfer.types.includes("application/x-deeprecall-blob") ||
      e.dataTransfer.types.includes("application/x-blob-id") ||
      e.dataTransfer.types.includes("application/x-asset-id")
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "link";
    }
  };

  const handleLibraryDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDraggingOverLibrary(false);
      }
      return newCount;
    });
  };

  const handleLibraryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverLibrary(false);
    setDragCounter(0);

    // Try to get blob data
    const blobJson = e.dataTransfer.getData("application/x-deeprecall-blob");
    if (blobJson) {
      try {
        const blob = JSON.parse(blobJson) as BlobWithMetadata;
        setLinkingBlob(blob);
      } catch (error) {
        console.error("Failed to parse dropped blob:", error);
      }
    }
  };

  // Reset drag state when drag ends (safety cleanup)
  const handleDragEnd = () => {
    setIsDraggingOverLibrary(false);
    setDragCounter(0);
  };
  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Sidebar */}
      <LibraryLeftSidebar onCreateWorkWithPreset={handleCreateWorkWithPreset} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <div className="max-w-7xl mx-auto px-8 py-4">
            <LibraryHeader
              workCount={works?.length || 0}
              onCreateActivity={() => setIsCreateActivityDialogOpen(true)}
              onCreateWork={() => setIsCreateDialogOpen(true)}
              onOpenTemplates={openTemplateLibrary}
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8 space-y-6">
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
                    onDropWork={handleDropWorkToActivity}
                    onDropBlob={handleDropBlobToActivity}
                    onDropAsset={handleDropAssetToActivity}
                    onUnlinkWork={handleUnlinkWorkFromActivity}
                    onUnlinkAsset={handleUnlinkAssetFromActivity}
                  />
                ))}
              </div>
            )}

            {/* Works Drop Zone - Wraps works area or empty state */}
            <div
              className={`transition-all ${
                isDraggingOverLibrary
                  ? "bg-blue-500/5 border-2 border-dashed border-blue-500/30 rounded-lg mx-8 min-h-[200px]"
                  : ""
              }`}
              onDragEnter={handleLibraryDragEnter}
              onDragOver={handleLibraryDragOver}
              onDragLeave={handleLibraryDragLeave}
              onDrop={handleLibraryDrop}
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-neutral-400">Loading library...</div>
                </div>
              ) : filteredWorks.length === 0 ? (
                <div className="text-center py-12 relative">
                  {isDraggingOverLibrary && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <div className="flex flex-col items-center gap-2">
                        <Link2 className="w-8 h-8 text-blue-400" />
                        <p className="text-sm font-medium text-blue-400">
                          Drop to create or link work
                        </p>
                      </div>
                    </div>
                  )}
                  <div className={isDraggingOverLibrary ? "opacity-0" : ""}>
                    <BookOpen className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
                    {searchQuery ||
                    selectedType !== "all" ||
                    showFavoritesOnly ? (
                      <>
                        <p className="text-neutral-400">
                          No works match your filters
                        </p>
                        <p className="text-neutral-600 text-sm mt-2">
                          Try adjusting your search or filters
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-neutral-400">
                          No works in library yet
                        </p>
                        <p className="text-neutral-600 text-sm mt-2">
                          Scan your files or create a new work to get started
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className={isDraggingOverLibrary ? "pb-20" : ""}>
                  {/* Drop zone indicator overlay for when works exist */}
                  {isDraggingOverLibrary && (
                    <div className="absolute inset-x-0 bottom-0 pointer-events-none z-10 flex items-center justify-center pb-8">
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-6 py-3 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <Link2 className="w-5 h-5 text-blue-400" />
                          <p className="text-sm font-medium text-blue-400">
                            Drop to create or link work
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {viewMode === "list" ? (
                    <div className="space-y-1">
                      {filteredWorks.map((work) => (
                        <WorkCardList
                          key={work.id}
                          work={work}
                          onClick={() => {
                            /* TODO: navigate to work detail page */
                          }}
                        />
                      ))}
                    </div>
                  ) : viewMode === "detailed" ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {filteredWorks.map((work) => (
                        <WorkCardDetailed
                          key={work.id}
                          work={work}
                          onClick={() => {
                            /* TODO: navigate to work detail page */
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredWorks.map((work) => (
                        <WorkCardCompact
                          key={work.id}
                          work={work}
                          onClick={() => {
                            /* TODO: navigate to work detail page */
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Work Dialog */}
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
          // Works will auto-refresh via useLiveQuery
        }}
      />

      {/* Create Activity Dialog */}
      <CreateActivityDialog
        isOpen={isCreateActivityDialogOpen}
        onClose={() => setIsCreateActivityDialogOpen(false)}
        onSuccess={() => {
          setIsCreateActivityDialogOpen(false);
          // Activities will auto-refresh via useLiveQuery
        }}
      />

      {/* Link Blob Dialog - for drag & drop to library area */}
      {linkingBlob && (
        <LinkBlobDialog
          blob={linkingBlob}
          onSuccess={() => {
            setLinkingBlob(null);
            // Works and unlinkedAssets will auto-refresh via useLiveQuery
          }}
          onCancel={() => setLinkingBlob(null)}
        />
      )}

      {/* Template Library Modal */}
      <TemplateLibrary />
    </div>
  );
}
