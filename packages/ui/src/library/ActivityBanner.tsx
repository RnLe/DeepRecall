/**
 * ActivityBanner Component
 * Displays an activity as a full-width banner that can accept dropped works/assets
 * Empty state: Thin banner with title and info in one line
 * Populated state: Expands to show contained materials in a grid
 */

"use client";

import { useState } from "react";
import type { ActivityExtended, Work, Asset } from "@deeprecall/core";
import {
  Calendar,
  Building2,
  ChevronDown,
  ChevronUp,
  X,
  Grid3x3,
  List,
} from "lucide-react";

interface ActivityBannerProps {
  activity: ActivityExtended;
  onDropWork: (activityId: string, workId: string) => void;
  onDropBlob: (activityId: string, blobId: string) => void;
  onDropAsset: (activityId: string, assetId: string) => void;
  onDropFiles: (activityId: string, files: FileList) => void;
  onUnlinkWork: (activityId: string, workId: string) => void;
  onUnlinkAsset: (activityId: string, assetId: string) => void;

  // Card components - injected for platform independence
  WorkCardCompact: React.ComponentType<{ work: Work; onClick: () => void }>;
  WorkCardList: React.ComponentType<{ work: Work; onClick: () => void }>;
}

const ACTIVITY_TYPE_ICONS: Record<string, string> = {
  course: "📚",
  workshop: "🛠️",
  project: "🚀",
  thesis: "🎓",
  seminar: "💡",
  reading_group: "📖",
  conference: "🎤",
};

const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  course: "border-amber-600/50",
  workshop: "border-amber-600/50",
  project: "border-amber-600/50",
  thesis: "border-amber-600/50",
  seminar: "border-amber-600/50",
  reading_group: "border-amber-600/50",
  conference: "border-amber-600/50",
};

export function ActivityBanner({
  activity,
  onDropWork,
  onDropBlob,
  onDropAsset,
  onDropFiles,
  onUnlinkWork,
  onUnlinkAsset,
  WorkCardCompact,
  WorkCardList,
}: ActivityBannerProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [workViewMode, setWorkViewMode] = useState<"compact" | "list">(
    "compact"
  );

  const works = activity.works || [];
  const assets = activity.assets || [];
  const hasContent = works.length > 0 || assets.length > 0;

  const colorClass =
    ACTIVITY_TYPE_COLORS[activity.activityType] ||
    "border-neutral-500/40 bg-neutral-500/5";
  const icon = ACTIVITY_TYPE_ICONS[activity.activityType] || "📋";

  // Format date range
  const formatDateRange = () => {
    if (!activity.startsAt && !activity.endsAt) return null;

    try {
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      };

      const start = activity.startsAt ? formatDate(activity.startsAt) : null;
      const end = activity.endsAt ? formatDate(activity.endsAt) : null;

      if (start && end) return `${start} - ${end}`;
      if (start) return `From ${start}`;
      if (end) return `Until ${end}`;
    } catch (error) {
      console.error("Error formatting dates:", error);
    }
    return null;
  };

  const dateRange = formatDateRange();

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    // Accept both internal drag data and external files
    if (
      e.dataTransfer.types.includes("application/x-work-id") ||
      e.dataTransfer.types.includes("application/x-blob-id") ||
      e.dataTransfer.types.includes("application/x-asset-id") ||
      e.dataTransfer.types.includes("Files")
    ) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only clear isDragOver if we're truly leaving the banner, not just entering a child
    const relatedTarget = e.relatedTarget as Node | null;
    const currentTarget = e.currentTarget as Node;

    if (relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }

    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Priority 1: Check for external files
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onDropFiles(activity.id, files);
      return;
    }

    // Priority 2: Check for drag data
    const workId = e.dataTransfer.getData("application/x-work-id");
    const blobId = e.dataTransfer.getData("application/x-blob-id");
    const assetId = e.dataTransfer.getData("application/x-asset-id");

    if (workId) {
      onDropWork(activity.id, workId);
    } else if (assetId) {
      // Prefer linking existing Assets by ID when available
      // This avoids accidentally creating a duplicate Asset from the same blob
      // Edge: { fromId: activityId, toId: assetId, relation: "contains" }
      onDropAsset(activity.id, assetId);
    } else if (blobId) {
      // Fallback: Blob dropped (e.g., from New Files inbox) → create Asset then link
      onDropBlob(activity.id, blobId);
    }
  };

  return (
    <div
      className={`w-full rounded-xl transition-all overflow-hidden ${
        isDragOver ? "ring-2 ring-amber-500 shadow-lg shadow-amber-500/20" : ""
      } ${hasContent && !isCollapsed ? `border-2 ${colorClass}` : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header - Always Visible - Solid Amber Background */}
      <div
        className={`flex items-center justify-between px-6 py-3 bg-amber-600 ${
          hasContent
            ? "cursor-pointer hover:bg-amber-700 transition-colors"
            : ""
        }`}
        onClick={() => hasContent && setIsCollapsed(!isCollapsed)}
      >
        {/* Left: Title and Info */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className="text-2xl shrink-0">{icon}</span>
          <div className="flex items-baseline gap-3 flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white truncate">
              {activity.title}
            </h3>
            <div className="flex items-center gap-3 text-sm text-amber-100 shrink-0">
              {activity.institution && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {activity.institution}
                </span>
              )}
              {dateRange && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {dateRange}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Stats, View Toggle, and Collapse Button */}
        <div className="flex items-center gap-3">
          {hasContent && (
            <>
              <div className="text-sm text-amber-100">
                {works.length} work{works.length !== 1 ? "s" : ""}
                {assets.length > 0 &&
                  `, ${assets.length} file${assets.length !== 1 ? "s" : ""}`}
              </div>

              {/* View mode toggle */}
              {works.length > 0 && (
                <div className="flex items-center gap-1 bg-amber-700 rounded p-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setWorkViewMode("compact");
                    }}
                    className={`p-1 rounded transition-colors ${
                      workViewMode === "compact"
                        ? "bg-amber-800 text-white"
                        : "text-amber-200 hover:text-white"
                    }`}
                    title="Compact view"
                  >
                    <Grid3x3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setWorkViewMode("list");
                    }}
                    className={`p-1 rounded transition-colors ${
                      workViewMode === "list"
                        ? "bg-amber-800 text-white"
                        : "text-amber-200 hover:text-white"
                    }`}
                    title="List view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCollapsed(!isCollapsed);
                }}
                className="p-1.5 text-amber-100 hover:text-white hover:bg-amber-800/50 rounded-lg transition-colors"
                title={isCollapsed ? "Expand" : "Collapse"}
              >
                {isCollapsed ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronUp className="w-5 h-5" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content Area - Expands when populated */}
      {hasContent && !isCollapsed && (
        <div className="bg-neutral-900/30 px-6 py-4">
          {/* Description if present */}
          {activity.description && (
            <p className="text-sm text-neutral-400 mb-4">
              {activity.description}
            </p>
          )}

          {/* Works Display */}
          {works.length > 0 && (
            <div
              className={
                workViewMode === "compact"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  : "space-y-2"
              }
            >
              {works.map((work) => (
                <div key={work.id} className="relative group/work">
                  {workViewMode === "compact" ? (
                    <WorkCardCompact
                      work={work}
                      onClick={() => {
                        /* TODO: navigate to work detail */
                      }}
                    />
                  ) : (
                    <WorkCardList
                      work={work}
                      onClick={() => {
                        /* TODO: navigate to work detail */
                      }}
                    />
                  )}
                  {/* Remove Work button positioned with its center at the card's corner */}
                  <button
                    onClick={() => onUnlinkWork(activity.id, work.id)}
                    className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover/work:opacity-100 transition-all hover:bg-red-500 z-10"
                    title="Remove from activity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Assets/Files */}
          {assets.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-neutral-300 mb-2">
                Files
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="group/asset flex items-center justify-between px-3 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:border-neutral-600 transition-colors"
                  >
                    <span className="truncate flex-1">{asset.filename}</span>
                    <button
                      onClick={() => onUnlinkAsset(activity.id, asset.id)}
                      className="ml-2 p-1 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover/asset:opacity-100 transition-all"
                      title="Remove from activity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State Message */}
      {!hasContent && (
        <div className="px-6 pb-3 bg-amber-600">
          <p className="text-xs text-amber-100 italic">
            Drag works or files here to assign them to this activity
          </p>
        </div>
      )}
    </div>
  );
}
