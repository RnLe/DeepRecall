/**
 * Library filters component
 * Search, filter by type, sort options
 */

"use client";

import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  Grid3x3,
  List,
} from "lucide-react";
import { useState } from "react";
import type { WorkType } from "@deeprecall/core";

export type ViewMode = "detailed" | "compact" | "list";

interface LibraryFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedType: WorkType | "all";
  onTypeChange: (type: WorkType | "all") => void;
  sortBy: "title" | "date" | "author";
  onSortChange: (sort: "title" | "date" | "author") => void;
  showFavoritesOnly: boolean;
  onToggleFavorites: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showActivities: boolean;
  onToggleActivities: () => void;
}

const workTypes: Array<{ value: WorkType | "all"; label: string }> = [
  { value: "all", label: "All Types" },
  { value: "paper", label: "Papers" },
  { value: "textbook", label: "Textbooks" },
  { value: "thesis", label: "Theses" },
  { value: "notes", label: "Notes" },
  { value: "slides", label: "Slides" },
  { value: "book", label: "Books" },
  { value: "article", label: "Articles" },
  { value: "other", label: "Other" },
];

export function LibraryFilters({
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
  sortBy,
  onSortChange,
  showFavoritesOnly,
  onToggleFavorites,
  viewMode,
  onViewModeChange,
  showActivities,
  onToggleActivities,
}: LibraryFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search works by title..."
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-700 focus:bg-neutral-900/80 transition-colors"
          />
        </div>

        {/* Activities toggle */}
        <button
          onClick={onToggleActivities}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            showActivities
              ? "bg-amber-600 text-white hover:bg-amber-700"
              : "bg-neutral-900/50 text-neutral-400 border border-neutral-800 hover:bg-neutral-800 hover:text-neutral-200"
          }`}
          title={showActivities ? "Hide activities" : "Show activities"}
        >
          📚 Activities
        </button>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-neutral-900/50 border border-neutral-800 rounded-lg p-1">
          <button
            onClick={() => onViewModeChange("detailed")}
            className={`p-2 rounded transition-colors ${
              viewMode === "detailed"
                ? "bg-neutral-800 text-neutral-200"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
            title="Detailed view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange("compact")}
            className={`p-2 rounded transition-colors ${
              viewMode === "compact"
                ? "bg-neutral-800 text-neutral-200"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
            title="Compact view"
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            className={`p-2 rounded transition-colors ${
              viewMode === "list"
                ? "bg-neutral-800 text-neutral-200"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg text-sm transition-colors ${
            showFilters
              ? "bg-neutral-800 border-neutral-700 text-neutral-200"
              : "bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Filter options (collapsible) */}
      {showFilters && (
        <div className="flex items-center gap-3 p-4 bg-neutral-900/30 border border-neutral-800/50 rounded-lg">
          {/* Work type filter */}
          <div className="flex-1">
            <label className="text-xs text-neutral-500 mb-1.5 block">
              Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => onTypeChange(e.target.value as WorkType | "all")}
              className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-sm text-neutral-300 focus:outline-none focus:border-neutral-700"
            >
              {workTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort by */}
          <div className="flex-1">
            <label className="text-xs text-neutral-500 mb-1.5 block">
              Sort
            </label>
            <select
              value={sortBy}
              onChange={(e) =>
                onSortChange(e.target.value as "title" | "date" | "author")
              }
              className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-sm text-neutral-300 focus:outline-none focus:border-neutral-700"
            >
              <option value="title">Title (A-Z)</option>
              <option value="date">Date (Newest)</option>
              <option value="author">Author (A-Z)</option>
            </select>
          </div>

          {/* Favorites toggle */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showFavoritesOnly}
                onChange={onToggleFavorites}
                className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-amber-500 focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-sm text-neutral-400">Favorites only</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
