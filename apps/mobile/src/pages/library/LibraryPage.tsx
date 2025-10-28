/**
 * Library Page for Mobile (Capacitor)
 * Mirrors web app structure with mobile-specific wrappers
 */

"use client";

import { useState, useMemo, useEffect } from "react";
import { BookOpen } from "lucide-react";

// ========================================
// PURE UI IMPORTS (from @deeprecall/ui)
// ========================================
import {
  LibraryFilters,
  CreateWorkDialog,
  CreateActivityDialog,
  TemplateLibrary,
} from "@deeprecall/ui/library";
import { compareWorksByTitle } from "@deeprecall/ui/utils";
import type {
  WorkType,
  WorkExtended,
  ActivityExtended,
  BlobWithMetadata,
} from "@deeprecall/core";

// ViewMode type
type ViewMode = "detailed" | "compact" | "list";

// ========================================
// PLATFORM WRAPPERS (from ./_components)
// ========================================
import {
  LibraryHeader,
  LibraryLeftSidebar,
  WorkCardDetailed,
  WorkCardCompact,
  WorkCardList,
  ActivityBanner,
  AuthorLibrary,
  LinkBlobDialog,
  ExportDataDialog,
  ImportDataDialog,
  UploadButton,
} from "./_components";

// ========================================
// PLATFORM HOOKS & UTILITIES
// ========================================
import { useWorks, useAssets, useActivities } from "@deeprecall/data/hooks";
import { activities as activityRepo } from "@deeprecall/data/repos";
import { useTemplateLibraryUI } from "@deeprecall/data/stores";

export default function LibraryPage() {
  // Electric hooks - real-time synced data
  const { data: worksData, isLoading: worksLoading } = useWorks();
  const { data: assetsData } = useAssets();
  const { data: activitiesData, isLoading: activitiesLoading } =
    useActivities();

  // Client-side join: Combine works with their assets to create "extended" works
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
  const [isAuthorLibraryOpen, setIsAuthorLibraryOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // Template Library UI state from Zustand
  const templateLibraryUI = useTemplateLibraryUI();
  const openTemplateLibrary = templateLibraryUI.openModal;

  // Enrich activities with their contained works/assets
  const [enrichedActivities, setEnrichedActivities] = useState<
    ActivityExtended[]
  >([]);

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
          return bYear - aYear; // Descending (newest first)
        });
        break;
    }

    return sorted;
  }, [works, searchQuery, selectedType, sortBy, showFavoritesOnly]);

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

            {/* Upload Button - Mobile specific */}
            <div className="mt-4 flex justify-end">
              <UploadButton />
            </div>
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
                  <ActivityBanner key={activity.id} activity={activity} />
                ))}
              </div>
            )}

            {/* Works Area */}
            <div>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-neutral-400">Loading library...</div>
                </div>
              ) : filteredWorks.length === 0 ? (
                <div className="text-center py-12">
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
                        Create a new work to get started
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {viewMode === "list" ? (
                    <div className="space-y-1">
                      {filteredWorks.map((work) => (
                        <WorkCardList key={work.id} work={work} />
                      ))}
                    </div>
                  ) : viewMode === "detailed" ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {filteredWorks.map((work) => (
                        <WorkCardDetailed key={work.id} work={work} />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredWorks.map((work) => (
                        <WorkCardCompact key={work.id} work={work} />
                      ))}
                    </div>
                  )}
                </>
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
        }}
      />

      {/* Create Activity Dialog */}
      <CreateActivityDialog
        isOpen={isCreateActivityDialogOpen}
        onClose={() => setIsCreateActivityDialogOpen(false)}
        onSuccess={() => setIsCreateActivityDialogOpen(false)}
      />

      {/* Template Library Modal */}
      <TemplateLibrary />

      {/* Author Library Modal */}
      <AuthorLibrary
        isOpen={isAuthorLibraryOpen}
        onClose={() => setIsAuthorLibraryOpen(false)}
      />

      {/* Link Blob Dialog */}
      {linkingBlob && (
        <LinkBlobDialog
          blob={linkingBlob}
          onSuccess={() => setLinkingBlob(null)}
          onCancel={() => setLinkingBlob(null)}
        />
      )}

      {/* Export Data Dialog */}
      <ExportDataDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
      />

      {/* Import Data Dialog */}
      <ImportDataDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
      />
    </div>
  );
}
