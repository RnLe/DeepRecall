/**
 * ExerciseFilters - Filter controls for exercise list
 */

"use client";

import { useMemo } from "react";
import { Filter, X, Search } from "lucide-react";
import type {
  DomainId,
  DifficultyLevel,
  ExerciseTag,
  ExerciseKind,
} from "@deeprecall/dojo-core";
import {
  DOMAIN_LABELS,
  DIFFICULTY_LEVELS,
  DIFFICULTY_LABELS,
  EXERCISE_TAGS,
  EXERCISE_TAG_LABELS,
  EXERCISE_KINDS,
  EXERCISE_KIND_LABELS,
} from "@deeprecall/dojo-core";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
import { ExerciseKindBadge } from "../components/ExerciseKindBadge";

export interface ExerciseFilterState {
  search: string;
  domains: DomainId[];
  difficulties: DifficultyLevel[];
  tags: ExerciseTag[];
  exerciseKinds: ExerciseKind[];
  showOnlyDue: boolean;
  showOnlyNew: boolean;
}

export const DEFAULT_FILTER_STATE: ExerciseFilterState = {
  search: "",
  domains: [],
  difficulties: [],
  tags: [],
  exerciseKinds: [],
  showOnlyDue: false,
  showOnlyNew: false,
};

export interface ExerciseFiltersProps {
  /** Current filter state */
  filters: ExerciseFilterState;
  /** Filter change callback */
  onFiltersChange: (filters: ExerciseFilterState) => void;
  /** Available domains (for filter options) */
  availableDomains?: DomainId[];
  /** Whether filters are expanded */
  expanded?: boolean;
  /** Toggle expanded state */
  onExpandedChange?: (expanded: boolean) => void;
}

/**
 * Filter controls for the exercise list
 */
export function ExerciseFilters({
  filters,
  onFiltersChange,
  availableDomains = [],
  expanded = false,
  onExpandedChange,
}: ExerciseFiltersProps) {
  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.search.length > 0 ||
      filters.domains.length > 0 ||
      filters.difficulties.length > 0 ||
      filters.tags.length > 0 ||
      filters.exerciseKinds.length > 0 ||
      filters.showOnlyDue ||
      filters.showOnlyNew
    );
  }, [filters]);

  // Clear all filters
  const clearFilters = () => {
    onFiltersChange(DEFAULT_FILTER_STATE);
  };

  // Toggle a domain filter
  const toggleDomain = (domain: DomainId) => {
    const newDomains = filters.domains.includes(domain)
      ? filters.domains.filter((d) => d !== domain)
      : [...filters.domains, domain];
    onFiltersChange({ ...filters, domains: newDomains });
  };

  // Toggle a difficulty filter
  const toggleDifficulty = (difficulty: DifficultyLevel) => {
    const newDifficulties = filters.difficulties.includes(difficulty)
      ? filters.difficulties.filter((d) => d !== difficulty)
      : [...filters.difficulties, difficulty];
    onFiltersChange({ ...filters, difficulties: newDifficulties });
  };

  // Toggle a tag filter
  const toggleTag = (tag: ExerciseTag) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    onFiltersChange({ ...filters, tags: newTags });
  };

  // Toggle an exercise kind filter
  const toggleExerciseKind = (kind: ExerciseKind) => {
    const newKinds = filters.exerciseKinds.includes(kind)
      ? filters.exerciseKinds.filter((k) => k !== kind)
      : [...filters.exerciseKinds, kind];
    onFiltersChange({ ...filters, exerciseKinds: newKinds });
  };

  return (
    <div className="space-y-3">
      {/* Search and filter toggle row */}
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Search exercises..."
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
            className="w-full pl-9 pr-3 py-2 bg-gray-800/60 border border-gray-700/50 rounded-lg text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40"
          />
          {filters.search && (
            <IconButton
              icon={X}
              size="sm"
              title="Clear search"
              variant="ghost"
              className="absolute right-1 top-1/2 -translate-y-1/2"
              onClick={() => onFiltersChange({ ...filters, search: "" })}
            />
          )}
        </div>

        {/* Filter toggle button */}
        <Button
          variant={expanded ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onExpandedChange?.(!expanded)}
          iconLeft={<Filter size={14} />}
        >
          Filters
          {hasActiveFilters && (
            <span className="ml-1 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
              {filters.domains.length +
                filters.difficulties.length +
                filters.tags.length +
                filters.exerciseKinds.length +
                (filters.showOnlyDue ? 1 : 0) +
                (filters.showOnlyNew ? 1 : 0)}
            </span>
          )}
        </Button>

        {/* Clear all */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </div>

      {/* Expanded filter section */}
      {expanded && (
        <div className="p-4 bg-gray-800/40 rounded-lg border border-gray-700/50 space-y-4">
          {/* Quick filters */}
          <div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Quick Filters
            </span>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge
                variant={filters.showOnlyDue ? "warning" : "ghost"}
                size="sm"
                className="cursor-pointer"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    showOnlyDue: !filters.showOnlyDue,
                  })
                }
              >
                Due for Review
              </Badge>
              <Badge
                variant={filters.showOnlyNew ? "primary" : "ghost"}
                size="sm"
                className="cursor-pointer"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    showOnlyNew: !filters.showOnlyNew,
                  })
                }
              >
                New Only
              </Badge>
            </div>
          </div>

          {/* Domains */}
          {availableDomains.length > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Domain
              </span>
              <div className="flex flex-wrap gap-2 mt-2">
                {availableDomains.map((domain) => (
                  <Badge
                    key={domain}
                    variant={
                      filters.domains.includes(domain) ? "primary" : "ghost"
                    }
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => toggleDomain(domain)}
                  >
                    {DOMAIN_LABELS[domain] || domain}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Difficulty */}
          <div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Difficulty
            </span>
            <div className="flex flex-wrap gap-2 mt-2">
              {DIFFICULTY_LEVELS.map((level) => (
                <Badge
                  key={level}
                  variant={
                    filters.difficulties.includes(level)
                      ? `difficulty-${level}`
                      : "ghost"
                  }
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => toggleDifficulty(level)}
                >
                  {DIFFICULTY_LABELS[level]}
                </Badge>
              ))}
            </div>
          </div>

          {/* Exercise Kind */}
          <div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Exercise Kind
            </span>
            <div className="flex flex-wrap gap-2 mt-2">
              {EXERCISE_KINDS.map((kind) => (
                <div
                  key={kind}
                  className="cursor-pointer"
                  onClick={() => toggleExerciseKind(kind)}
                >
                  <ExerciseKindBadge
                    kind={kind}
                    size="sm"
                    className={
                      filters.exerciseKinds.includes(kind)
                        ? ""
                        : "opacity-50 hover:opacity-75"
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Type
            </span>
            <div className="flex flex-wrap gap-2 mt-2">
              {EXERCISE_TAGS.map((tag) => (
                <Badge
                  key={tag}
                  variant={filters.tags.includes(tag) ? "info" : "ghost"}
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => toggleTag(tag)}
                >
                  {EXERCISE_TAG_LABELS[tag]}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
