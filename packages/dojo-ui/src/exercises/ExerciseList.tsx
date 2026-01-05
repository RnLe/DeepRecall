/**
 * ExerciseList - Exercise browsing and selection component
 */

"use client";

import { useState, useMemo } from "react";
import { BookOpen, Sparkles, Clock, ListFilter } from "lucide-react";
import type {
  ExerciseTemplate,
  ExerciseBrickState,
  SchedulerItem,
  DomainId,
} from "@deeprecall/dojo-core";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { ExerciseCard } from "./ExerciseCard";
import {
  ExerciseFilters,
  type ExerciseFilterState,
  DEFAULT_FILTER_STATE,
} from "./ExerciseFilters";

export interface ExerciseListProps {
  /** All available exercises */
  exercises: ExerciseTemplate[];
  /** User's brick states (keyed by template ID) */
  brickStates?: Map<string, ExerciseBrickState>;
  /** Scheduled items (for "due" indicators) */
  scheduledItems?: SchedulerItem[];
  /** Recommended exercise IDs */
  recommendedIds?: string[];
  /** Handler when exercise is selected */
  onSelectExercise: (exercise: ExerciseTemplate) => void;
  /** Whether to show the header */
  showHeader?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * Exercise list with filtering and organization
 */
export function ExerciseList({
  exercises,
  brickStates = new Map(),
  scheduledItems = [],
  recommendedIds = [],
  onSelectExercise,
  showHeader = true,
  isLoading = false,
  emptyMessage = "No exercises found",
}: ExerciseListProps) {
  const [filters, setFilters] =
    useState<ExerciseFilterState>(DEFAULT_FILTER_STATE);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Get unique domains for filter options
  const availableDomains = useMemo(() => {
    const domains = new Set<DomainId>();
    exercises.forEach((e) => domains.add(e.domainId));
    return Array.from(domains);
  }, [exercises]);

  // Set of due exercise IDs
  const dueExerciseIds = useMemo(() => {
    const now = new Date();
    return new Set(
      scheduledItems
        .filter((item) => new Date(item.scheduledFor) <= now)
        .map((item) => item.templateId)
    );
  }, [scheduledItems]);

  // Set of recommended IDs
  const recommendedSet = useMemo(
    () => new Set(recommendedIds),
    [recommendedIds]
  );

  // Filter exercises
  const filteredExercises = useMemo(() => {
    return exercises.filter((exercise) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          exercise.title.toLowerCase().includes(searchLower) ||
          exercise.description?.toLowerCase().includes(searchLower) ||
          exercise.domainId.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Domain filter
      if (filters.domains.length > 0) {
        if (!filters.domains.includes(exercise.domainId)) return false;
      }

      // Difficulty filter
      if (filters.difficulties.length > 0) {
        if (!filters.difficulties.includes(exercise.difficulty)) return false;
      }

      // Tag filter
      if (filters.tags.length > 0) {
        if (!filters.tags.some((tag) => exercise.tags.includes(tag)))
          return false;
      }

      // Due filter
      if (filters.showOnlyDue) {
        if (!dueExerciseIds.has(exercise.id)) return false;
      }

      // New filter
      if (filters.showOnlyNew) {
        const brick = brickStates.get(exercise.id);
        if (brick && brick.metrics.totalAttempts > 0) return false;
      }

      return true;
    });
  }, [exercises, filters, dueExerciseIds, brickStates]);

  // Group exercises: Due → Recommended → Rest
  const groupedExercises = useMemo(() => {
    const due: ExerciseTemplate[] = [];
    const recommended: ExerciseTemplate[] = [];
    const rest: ExerciseTemplate[] = [];

    filteredExercises.forEach((exercise) => {
      if (dueExerciseIds.has(exercise.id)) {
        due.push(exercise);
      } else if (recommendedSet.has(exercise.id)) {
        recommended.push(exercise);
      } else {
        rest.push(exercise);
      }
    });

    return { due, recommended, rest };
  }, [filteredExercises, dueExerciseIds, recommendedSet]);

  // Stats
  const stats = useMemo(() => {
    const total = exercises.length;
    const dueCount = dueExerciseIds.size;
    const attemptedCount = Array.from(brickStates.values()).filter(
      (b) => b.metrics.totalAttempts > 0
    ).length;
    return { total, dueCount, attemptedCount };
  }, [exercises, dueExerciseIds, brickStates]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-700 border-t-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-100">Exercises</h2>
            <p className="text-sm text-gray-500">
              {stats.total} exercises · {stats.attemptedCount} attempted ·{" "}
              {stats.dueCount} due
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <ExerciseFilters
        filters={filters}
        onFiltersChange={setFilters}
        availableDomains={availableDomains}
        expanded={filtersExpanded}
        onExpandedChange={setFiltersExpanded}
      />

      {/* Exercise groups */}
      {filteredExercises.length === 0 ? (
        <Card variant="ghost" padding="lg" className="text-center">
          <ListFilter size={32} className="mx-auto text-gray-600 mb-2" />
          <p className="text-gray-400">{emptyMessage}</p>
          {(filters.search || filters.domains.length > 0) && (
            <p className="text-sm text-gray-500 mt-1">
              Try adjusting your filters
            </p>
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Due exercises */}
          {groupedExercises.due.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={16} className="text-amber-400" />
                <h3 className="text-sm font-medium text-gray-300">
                  Due for Review
                </h3>
                <Badge variant="warning" size="xs" pill>
                  {groupedExercises.due.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {groupedExercises.due.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    brickState={brickStates.get(exercise.id)}
                    isDue
                    onClick={() => onSelectExercise(exercise)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Recommended exercises */}
          {groupedExercises.recommended.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-emerald-400" />
                <h3 className="text-sm font-medium text-gray-300">
                  Recommended
                </h3>
              </div>
              <div className="space-y-2">
                {groupedExercises.recommended.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    brickState={brickStates.get(exercise.id)}
                    isRecommended
                    onClick={() => onSelectExercise(exercise)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* All other exercises */}
          {groupedExercises.rest.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={16} className="text-gray-400" />
                <h3 className="text-sm font-medium text-gray-300">
                  All Exercises
                </h3>
              </div>
              <div className="space-y-2">
                {groupedExercises.rest.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    brickState={brickStates.get(exercise.id)}
                    onClick={() => onSelectExercise(exercise)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
