/**
 * AuthorListView Component
 *
 * Grid/list view for browsing all authors
 */

import { useMemo } from "react";
import { Search, Plus, FileCode, User, LayoutGrid, List } from "lucide-react";
import type { Author } from "@deeprecall/core";
import { AuthorCard } from "./AuthorCard";

interface AuthorListViewProps {
  authors: Author[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: "lastName" | "firstName" | "createdAt";
  onSortChange: (sort: "lastName" | "firstName" | "createdAt") => void;
  displayMode: "cards" | "list";
  onDisplayModeChange: (mode: "cards" | "list") => void;
  onSelectAuthor: (authorId: string) => void;
  onCreateNew: () => void;
  onImportBibtex: () => void;
  works: any[];
  getAuthorFullName: (author: Author) => string;
  formatWorkStats: (stats: Record<string, number>) => string;
}

export function AuthorListView({
  authors,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  displayMode,
  onDisplayModeChange,
  onSelectAuthor,
  onCreateNew,
  onImportBibtex,
  works,
  getAuthorFullName,
  formatWorkStats,
}: AuthorListViewProps) {
  // Count works per author by type
  const authorWorkStats = useMemo(() => {
    const stats = new Map<string, Record<string, number>>();
    works.forEach((work) => {
      work.authorIds?.forEach((authorId: string) => {
        if (!stats.has(authorId)) {
          stats.set(authorId, {});
        }
        const authorStats = stats.get(authorId)!;
        const type = work.workType || "unknown";
        authorStats[type] = (authorStats[type] || 0) + 1;
      });
    });
    return stats;
  }, [works]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="shrink-0 px-6 py-4 border-b border-neutral-800 space-y-3">
        {/* Search and Actions */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search authors by name..."
              className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={onImportBibtex}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            <FileCode className="w-4 h-4" />
            Import from BibTeX
          </button>
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Author
          </button>
        </div>

        {/* Sort and Display Mode */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) =>
                onSortChange(
                  e.target.value as "lastName" | "firstName" | "createdAt"
                )
              }
              className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="lastName">Last Name</option>
              <option value="firstName">First Name</option>
              <option value="createdAt">Recently Added</option>
            </select>
          </div>

          {/* Display Mode Toggle */}
          <div className="flex items-center gap-1 bg-neutral-800 rounded-lg p-1">
            <button
              onClick={() => onDisplayModeChange("cards")}
              className={`p-1.5 rounded transition-colors ${
                displayMode === "cards"
                  ? "bg-blue-600 text-white"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
              title="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDisplayModeChange("list")}
              className={`p-1.5 rounded transition-colors ${
                displayMode === "list"
                  ? "bg-blue-600 text-white"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Author List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {authors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-4 bg-neutral-800 rounded-full mb-4">
              <User className="w-8 h-8 text-neutral-400" />
            </div>
            <p className="text-neutral-300 font-medium mb-2">
              {searchQuery ? "No authors found" : "No authors yet"}
            </p>
            <p className="text-sm text-neutral-500 mb-4">
              {searchQuery
                ? "Try a different search term"
                : "Create your first author or import from BibTeX"}
            </p>
            {!searchQuery && (
              <button
                onClick={onCreateNew}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Author
              </button>
            )}
          </div>
        ) : displayMode === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {authors.map((author) => (
              <AuthorCard
                key={author.id}
                author={author}
                mode="card"
                workStats={authorWorkStats.get(author.id)}
                onSelect={onSelectAuthor}
                getAuthorFullName={getAuthorFullName}
                formatWorkStats={formatWorkStats}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-1.5">
            {authors.map((author) => (
              <AuthorCard
                key={author.id}
                author={author}
                mode="list"
                workStats={authorWorkStats.get(author.id)}
                onSelect={onSelectAuthor}
                getAuthorFullName={getAuthorFullName}
                formatWorkStats={formatWorkStats}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
