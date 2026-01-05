/**
 * ConceptKindFilter - Filter for concept kinds
 * Can be used standalone or integrated into concept list/wall views
 */

"use client";

import { useMemo } from "react";
import type { ConceptKind } from "@deeprecall/dojo-core";
import { CONCEPT_KINDS, CONCEPT_KIND_LABELS } from "@deeprecall/dojo-core";
import { ConceptKindBadge } from "./ConceptKindBadge";

export interface ConceptKindFilterProps {
  /** Currently selected kinds (empty = all shown) */
  selectedKinds: ConceptKind[];
  /** Handler for when selection changes */
  onSelectionChange: (kinds: ConceptKind[]) => void;
  /** Whether to allow multiple selection */
  multiSelect?: boolean;
  /** Size variant */
  size?: "xs" | "sm" | "md";
  /** Label text */
  label?: string;
  /** Show count per kind */
  kindCounts?: Record<ConceptKind, number>;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Filter component for concept kinds
 */
export function ConceptKindFilter({
  selectedKinds,
  onSelectionChange,
  multiSelect = true,
  size = "sm",
  label = "Concept Type",
  kindCounts,
  className = "",
}: ConceptKindFilterProps) {
  const toggleKind = (kind: ConceptKind) => {
    if (multiSelect) {
      const newKinds = selectedKinds.includes(kind)
        ? selectedKinds.filter((k) => k !== kind)
        : [...selectedKinds, kind];
      onSelectionChange(newKinds);
    } else {
      // Single select: toggle between this kind and none
      onSelectionChange(selectedKinds.includes(kind) ? [] : [kind]);
    }
  };

  const clearSelection = () => {
    onSelectionChange([]);
  };

  const hasSelection = selectedKinds.length > 0;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          {label}
        </span>
        {hasSelection && (
          <button
            onClick={clearSelection}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {CONCEPT_KINDS.map((kind) => {
          const isSelected = selectedKinds.includes(kind);
          const count = kindCounts?.[kind];

          return (
            <div
              key={kind}
              className="cursor-pointer"
              onClick={() => toggleKind(kind)}
            >
              <ConceptKindBadge
                kind={kind}
                size={size}
                className={
                  isSelected
                    ? ""
                    : hasSelection
                      ? "opacity-40 hover:opacity-70"
                      : "opacity-70 hover:opacity-100"
                }
              />
              {count !== undefined && (
                <span className="ml-1 text-[10px] text-gray-500">
                  ({count})
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact version as a dropdown/popover trigger
 */
export function ConceptKindFilterCompact({
  selectedKinds,
  onSelectionChange,
  className = "",
}: {
  selectedKinds: ConceptKind[];
  onSelectionChange: (kinds: ConceptKind[]) => void;
  className?: string;
}) {
  const selectedLabel = useMemo(() => {
    if (selectedKinds.length === 0) return "All Types";
    if (selectedKinds.length === 1)
      return CONCEPT_KIND_LABELS[selectedKinds[0]];
    return `${selectedKinds.length} types`;
  }, [selectedKinds]);

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-300 bg-gray-800/60 border border-gray-700/50 rounded cursor-pointer hover:bg-gray-700/60 transition-colors ${className}`}
    >
      <span>{selectedLabel}</span>
      {selectedKinds.length > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectionChange([]);
          }}
          className="text-gray-500 hover:text-gray-300"
        >
          ×
        </button>
      )}
    </div>
  );
}

export { CONCEPT_KINDS, CONCEPT_KIND_LABELS };
