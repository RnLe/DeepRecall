/**
 * AgendaList - Display today's scheduled items and recommendations
 */

"use client";

import { useMemo } from "react";
import {
  Clock,
  Sparkles,
  Target,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import type {
  ExerciseTemplate,
  SchedulerItem,
  ExerciseBrickState,
} from "@deeprecall/dojo-core";
import { DOMAIN_LABELS } from "@deeprecall/dojo-core";
import { Card } from "../components/Card";
import { Badge, DifficultyBadge } from "../components/Badge";
import { ProgressRing } from "../components/ProgressRing";

export interface AgendaItem {
  exercise: ExerciseTemplate;
  schedulerItem?: SchedulerItem;
  brickState?: ExerciseBrickState;
  isRecommended?: boolean;
  isDue?: boolean;
  isNew?: boolean;
  /** Computed priority score (higher = more urgent) */
  priority?: number;
  /** Whether the item is overdue */
  isOverdue?: boolean;
}

export interface AgendaListProps {
  /** Items to display */
  items: AgendaItem[];
  /** Handler when an item is selected */
  onSelectItem: (exercise: ExerciseTemplate) => void;
  /** Maximum items to show (rest are collapsed) */
  maxItems?: number;
  /** Title for the list */
  title?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Show "View all" button */
  showViewAll?: boolean;
  /** Handler for "View all" */
  onViewAll?: () => void;
}

/**
 * List of scheduled/recommended exercises for today
 */
export function AgendaList({
  items,
  onSelectItem,
  maxItems = 5,
  title = "Today's Agenda",
  emptyMessage = "No items scheduled. Start exploring!",
  showViewAll = true,
  onViewAll,
}: AgendaListProps) {
  // Sort: use priority if available, otherwise fallback to due/recommended/new
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      // If both have priority scores, use those (higher priority first)
      if (a.priority !== undefined && b.priority !== undefined) {
        return b.priority - a.priority;
      }

      // If only one has priority, prioritize that one
      if (a.priority !== undefined) return -1;
      if (b.priority !== undefined) return 1;

      // Overdue items first
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;

      // Due items next
      if (a.isDue && !b.isDue) return -1;
      if (!a.isDue && b.isDue) return 1;

      // Then recommended
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;

      // Then new
      if (a.isNew && !b.isNew) return -1;
      if (!a.isNew && b.isNew) return 1;

      return 0;
    });
  }, [items]);

  const displayItems = sortedItems.slice(0, maxItems);
  const remainingCount = sortedItems.length - displayItems.length;

  if (items.length === 0) {
    return (
      <Card variant="outlined" padding="md" className="border-dashed">
        <div className="text-center py-4">
          <Target size={32} className="mx-auto text-gray-600 mb-2" />
          <p className="text-sm text-gray-500">{emptyMessage}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="font-medium text-gray-300">{title}</h3>
        <Badge variant="default" size="xs">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {displayItems.map((item) => (
          <AgendaItemCard
            key={item.exercise.id}
            item={item}
            onClick={() => onSelectItem(item.exercise)}
          />
        ))}
      </div>

      {/* View all button */}
      {showViewAll && remainingCount > 0 && onViewAll && (
        <button
          onClick={onViewAll}
          className="w-full py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center gap-1"
        >
          View {remainingCount} more
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

interface AgendaItemCardProps {
  item: AgendaItem;
  onClick: () => void;
}

function AgendaItemCard({ item, onClick }: AgendaItemCardProps) {
  const { exercise, brickState, isRecommended, isDue, isNew, isOverdue } = item;
  const domainLabel = DOMAIN_LABELS[exercise.domainId] || exercise.domainId;
  const mastery = brickState?.metrics.masteryScore ?? 0;
  const hasAttempts = (brickState?.metrics.totalAttempts ?? 0) > 0;

  return (
    <Card
      variant={isOverdue ? "elevated" : isDue ? "elevated" : "default"}
      padding="sm"
      interactive
      onClick={onClick}
      className={
        isOverdue ? "border-red-500/30" : isDue ? "border-amber-500/30" : ""
      }
    >
      <div className="flex items-center gap-3">
        {/* Mastery or status indicator */}
        {hasAttempts ? (
          <ProgressRing value={mastery} size={36} showValue />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-gray-700/50 flex items-center justify-center">
            {isNew ? (
              <Sparkles size={16} className="text-blue-400" />
            ) : (
              <Target size={16} className="text-gray-500" />
            )}
          </div>
        )}

        {/* Exercise info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-200 truncate">
            {exercise.title}
          </h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">{domainLabel}</span>
            <DifficultyBadge level={exercise.difficulty} size="xs" />
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-1">
          {isOverdue && (
            <Badge
              variant="danger"
              size="xs"
              pill
              icon={<AlertCircle size={10} />}
            >
              Overdue
            </Badge>
          )}
          {isDue && !isOverdue && (
            <Badge
              variant="warning"
              size="xs"
              pill
              icon={<AlertCircle size={10} />}
            >
              Due
            </Badge>
          )}
          {isRecommended && !isDue && (
            <Badge
              variant="success"
              size="xs"
              pill
              icon={<Sparkles size={10} />}
            >
              Rec
            </Badge>
          )}
          <ChevronRight size={14} className="text-gray-600" />
        </div>
      </div>
    </Card>
  );
}
