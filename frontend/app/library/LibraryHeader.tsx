/**
 * Library header component
 * Shows title, stats, and action buttons
 */

"use client";

import { BookOpen, FileText, Plus, User } from "lucide-react";
import { useBlobStats } from "@/src/hooks/useBlobs";

interface LibraryHeaderProps {
  workCount: number;
  onCreateWork?: () => void;
  onCreateActivity?: () => void;
  onOpenTemplates?: () => void;
  onOpenAuthors?: () => void;
}

export function LibraryHeader({
  workCount,
  onCreateWork,
  onCreateActivity,
  onOpenTemplates,
  onOpenAuthors,
}: LibraryHeaderProps) {
  const { data: blobStats } = useBlobStats();

  return (
    <div>
      <div className="flex items-center justify-between">
        {/* Title and stats */}
        <div className="flex items-center gap-6">
          <h1 className="text-3xl font-bold text-neutral-100">Library</h1>

          {/* Stats inline */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-neutral-500" />
              <span className="text-neutral-400">
                {workCount} {workCount === 1 ? "work" : "works"}
              </span>
            </div>

            {blobStats && (
              <>
                <div className="w-px h-4 bg-neutral-800" />
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-neutral-500" />
                  <span className="text-neutral-400">
                    {blobStats.totalBlobs}{" "}
                    {blobStats.totalBlobs === 1 ? "file" : "files"}
                  </span>
                </div>

                {blobStats.orphanedBlobs > 0 && (
                  <>
                    <div className="w-px h-4 bg-neutral-800" />
                    <span className="text-amber-500 text-xs">
                      {blobStats.orphanedBlobs} unlinked
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenAuthors && (
            <button
              onClick={onOpenAuthors}
              className="flex items-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm rounded-lg transition-colors border border-neutral-700 hover:border-neutral-600"
              title="Manage authors"
            >
              <User className="w-4 h-4" />
              Authors
            </button>
          )}

          {onOpenTemplates && (
            <button
              onClick={onOpenTemplates}
              className="flex items-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm rounded-lg transition-colors border border-neutral-700 hover:border-neutral-600"
              title="Manage work templates"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              Templates
            </button>
          )}

          <button
            onClick={async () => {
              if (
                confirm(
                  "⚠️ This will DELETE ALL DATA in your library (works, versions, assets, activities, collections, presets, annotations, and cards). This cannot be undone!\n\nAre you sure?"
                )
              ) {
                try {
                  const { db } = await import("@/src/db/dexie");
                  await db.delete();
                  alert("Database cleared! Reloading page...");
                  window.location.reload();
                } catch (error) {
                  console.error("Failed to clear database:", error);
                  alert("Failed to clear database. Check console for details.");
                }
              }
            }}
            className="flex items-center gap-2 px-3 py-2 bg-rose-900/50 hover:bg-rose-800/50 text-rose-300 text-sm rounded-lg transition-colors border border-rose-700/50 hover:border-rose-600"
            title="Clear entire database"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Clear DB
          </button>

          {onCreateActivity && (
            <button
              onClick={onCreateActivity}
              className="flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Activity
            </button>
          )}

          {onCreateWork && (
            <button
              onClick={onCreateWork}
              className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-white text-neutral-900 text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Work
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
