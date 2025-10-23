/**
 * WorkSelector Component (Platform-agnostic)
 * Displays existing works in a grid for selection
 */

import { BookOpen, Users } from "lucide-react";
import type { WorkExtended, Author } from "@deeprecall/core";

// Platform-agnostic operations interface
export interface WorkSelectorOperations {
  // Get authors by IDs for a work (returns Electric ShapeResult)
  useAuthorsByIds: (ids: string[]) => { data?: Author[]; isLoading: boolean };

  // Display utilities
  getPrimaryAuthors: (authors: Author[], maxCount: number) => string;
  getDisplayYear: (work: WorkExtended) => string | null;
}
interface WorkSelectorItemProps {
  work: WorkExtended;
  isSelected: boolean;
  onChange: () => void;
  operations: WorkSelectorOperations;
}

// Helper component to use hooks properly
function WorkSelectorItem({
  work,
  isSelected,
  onChange,
  operations,
}: WorkSelectorItemProps) {
  const { data: authorEntities = [] } = operations.useAuthorsByIds(
    work.authorIds || []
  );
  const authors = operations.getPrimaryAuthors(authorEntities, 2);
  const year = operations.getDisplayYear(work);

  return (
    <button
      onClick={onChange}
      className={`p-3 rounded-lg border transition-all text-left ${
        isSelected
          ? "bg-blue-950/30 border-blue-600"
          : "bg-neutral-800/50 border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800"
      }`}
    >
      <div className="font-medium text-sm text-neutral-100 mb-1 line-clamp-1">
        {work.title}
      </div>
      <div className="text-xs text-neutral-400">
        {authors} {year && `• ${year}`}
      </div>
      <div className="text-xs text-neutral-500 mt-1">
        {(work as any).assetCount || 0} file(s)
      </div>
    </button>
  );
}

// Detailed work item with full info
function WorkSelectorItemDetailed({
  work,
  isSelected,
  onChange,
  operations,
}: WorkSelectorItemProps) {
  const { data: authorEntities = [] } = operations.useAuthorsByIds(
    work.authorIds || []
  );
  const authors = operations.getPrimaryAuthors(authorEntities, 2);
  const year = operations.getDisplayYear(work);

  return (
    <button
      onClick={onChange}
      className={`text-left p-4 rounded-lg border-2 transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-900/20"
          : "border-neutral-700 bg-neutral-800/50 hover:border-neutral-600 hover:bg-neutral-800"
      }`}
    >
      <div className="flex items-start gap-3">
        <BookOpen
          className={`w-5 h-5 shrink-0 mt-0.5 ${
            isSelected ? "text-blue-400" : "text-neutral-400"
          }`}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-neutral-100 text-sm line-clamp-2 mb-1">
            {work.title}
          </h3>
          {work.subtitle && (
            <p className="text-xs text-neutral-500 line-clamp-1 mb-2">
              {work.subtitle}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <Users className="w-3 h-3" />
            <span className="truncate">{authors}</span>
            {year && (
              <>
                <span>·</span>
                <span>{year}</span>
              </>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 bg-neutral-700/50 text-neutral-400 rounded">
              {work.workType}
            </span>
            <span className="text-neutral-600">
              {(work as any).assetCount || 0} file(s)
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

interface WorkSelectorProps {
  value: string | null;
  onChange: (workId: string | null) => void;
  works: WorkExtended[];
  operations: WorkSelectorOperations;
}

export function WorkSelector({
  value,
  onChange,
  works,
  operations,
}: WorkSelectorProps) {
  if (!works || works.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500">
        <BookOpen className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
        <p className="text-sm">No works in library yet</p>
        <p className="text-xs text-neutral-600 mt-1">
          Create a new work using the templates below
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
      {works.map((work) => (
        <WorkSelectorItemDetailed
          key={work.id}
          work={work}
          isSelected={value === work.id}
          onChange={() => onChange(value === work.id ? null : work.id)}
          operations={operations}
        />
      ))}
    </div>
  );
}
