/**
 * Library header component
 * Shows title, stats, and action buttons
 */

"use client";

import { BookOpen, FileText, Plus, RefreshCw } from "lucide-react";
import { useScanMutation } from "@/src/hooks/useFilesQuery";
import { useBlobStats } from "@/src/hooks/useBlobs";

interface LibraryHeaderProps {
  workCount: number;
  onCreateWork?: () => void;
  onCreateActivity?: () => void;
}

export function LibraryHeader({
  workCount,
  onCreateWork,
  onCreateActivity,
}: LibraryHeaderProps) {
  const scanMutation = useScanMutation();
  const { data: blobStats } = useBlobStats();

  const handleScan = () => {
    scanMutation.mutate();
  };

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
          <button
            onClick={handleScan}
            disabled={scanMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 disabled:cursor-not-allowed text-neutral-300 text-sm rounded-lg transition-colors border border-neutral-700 hover:border-neutral-600"
          >
            <RefreshCw
              className={`w-4 h-4 ${scanMutation.isPending ? "animate-spin" : ""}`}
            />
            {scanMutation.isPending ? "Scanning..." : "Scan"}
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
