/**
 * BrickWall - Concept graph visualization as a "brick wall"
 * Displays concepts in a DAG layout with mastery coloring
 */

"use client";

import { useMemo, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, Maximize, Grid3X3, List, Info } from "lucide-react";
import type {
  ConceptNode,
  ConceptBrickState,
  ConceptNodeId,
} from "@deeprecall/dojo-core";
import { Card } from "../components/Card";
import { IconButton } from "../components/IconButton";
import { Badge } from "../components/Badge";
import { BrickNode } from "./BrickNode";

export interface BrickWallProps {
  /** All concepts to display */
  concepts: ConceptNode[];
  /** User's brick states (keyed by concept ID) */
  brickStates?: Map<string, ConceptBrickState>;
  /** Currently selected concept ID */
  selectedConceptId?: ConceptNodeId;
  /** Concepts with cram sessions */
  crammedConceptIds?: Set<string>;
  /** Handler when a concept is selected */
  onSelectConcept?: (concept: ConceptNode) => void;
  /** Handler to start practice on a concept */
  onPracticeConcept?: (concept: ConceptNode) => void;
  /** Title for the wall */
  title?: string;
  /** View mode */
  viewMode?: "wall" | "list";
  /** Whether to show controls */
  showControls?: boolean;
}

interface ConceptLevel {
  level: number;
  concepts: ConceptNode[];
}

/**
 * Compute topological levels for concepts
 * Level 0 = concepts with no prerequisites
 * Level N = concepts whose prerequisites are all at level < N
 */
function computeLevels(concepts: ConceptNode[]): ConceptLevel[] {
  const conceptMap = new Map<ConceptNodeId, ConceptNode>(
    concepts.map((c) => [c.id, c])
  );
  const levels = new Map<ConceptNodeId, number>();

  // Recursive level computation
  function getLevel(id: ConceptNodeId): number {
    if (levels.has(id)) return levels.get(id)!;

    const concept = conceptMap.get(id);
    if (!concept) return 0;

    // If no prerequisites, level is 0
    if (concept.prerequisiteIds.length === 0) {
      levels.set(id, 0);
      return 0;
    }

    // Level is max of prerequisite levels + 1
    let maxPrereqLevel = 0;
    for (const prereqId of concept.prerequisiteIds) {
      if (conceptMap.has(prereqId)) {
        maxPrereqLevel = Math.max(maxPrereqLevel, getLevel(prereqId) + 1);
      }
    }

    levels.set(id, maxPrereqLevel);
    return maxPrereqLevel;
  }

  // Compute levels for all concepts
  concepts.forEach((c) => getLevel(c.id));

  // Group by level
  const levelGroups = new Map<number, ConceptNode[]>();
  concepts.forEach((c) => {
    const level = levels.get(c.id) ?? 0;
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)!.push(c);
  });

  // Convert to sorted array
  const sortedLevels = Array.from(levelGroups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([level, concepts]) => ({
      level,
      concepts: concepts.sort((a, b) => {
        // Sort by importance (fundamental first), then by name
        const importanceOrder = {
          fundamental: 0,
          supporting: 1,
          enrichment: 2,
        };
        const aOrder = importanceOrder[a.importance] ?? 2;
        const bOrder = importanceOrder[b.importance] ?? 2;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name);
      }),
    }));

  return sortedLevels;
}

/**
 * Check if a concept's prerequisites are all mastered
 */
function isConceptUnlocked(
  concept: ConceptNode,
  brickStates: Map<string, ConceptBrickState>,
  conceptMap: Map<ConceptNodeId, ConceptNode>
): boolean {
  if (concept.prerequisiteIds.length === 0) return true;

  return concept.prerequisiteIds.every((prereqId) => {
    // If prerequisite doesn't exist in our set, consider it met
    if (!conceptMap.has(prereqId)) return true;

    const prereqState = brickStates.get(prereqId);
    // Unlocked if prereq has mastery >= 50
    return (prereqState?.metrics.masteryScore ?? 0) >= 50;
  });
}

/**
 * Concept graph visualization as a brick wall
 */
export function BrickWall({
  concepts,
  brickStates = new Map(),
  selectedConceptId,
  crammedConceptIds = new Set(),
  onSelectConcept,
  onPracticeConcept,
  title = "Concept Map",
  viewMode: initialViewMode = "wall",
  showControls = true,
}: BrickWallProps) {
  const [viewMode, setViewMode] = useState(initialViewMode);
  const [zoom, setZoom] = useState(1);

  const conceptMap = useMemo(
    () => new Map<ConceptNodeId, ConceptNode>(concepts.map((c) => [c.id, c])),
    [concepts]
  );

  const levels = useMemo(() => computeLevels(concepts), [concepts]);

  // Compute overall stats
  const stats = useMemo(() => {
    let totalMastery = 0;
    let masteredCount = 0;
    let newCount = 0;

    concepts.forEach((c) => {
      const brick = brickStates.get(c.id);
      const mastery = brick?.metrics.masteryScore ?? 0;
      totalMastery += mastery;
      if (mastery >= 70) masteredCount++;
      if (!brick || brick.metrics.totalAttempts === 0) newCount++;
    });

    return {
      averageMastery:
        concepts.length > 0 ? Math.round(totalMastery / concepts.length) : 0,
      masteredCount,
      totalCount: concepts.length,
      newCount,
    };
  }, [concepts, brickStates]);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 0.2, 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 0.2, 0.5));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  const selectedConcept = selectedConceptId
    ? conceptMap.get(selectedConceptId)
    : null;

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm">
              {stats.masteredCount}/{stats.totalCount} mastered
            </Badge>
            <Badge variant="default" size="sm">
              {stats.averageMastery}% avg
            </Badge>
          </div>
        </div>

        {showControls && (
          <div className="flex items-center gap-1">
            <IconButton
              icon={Grid3X3}
              title="Wall view"
              variant={viewMode === "wall" ? "secondary" : "ghost"}
              onClick={() => setViewMode("wall")}
              size="sm"
            />
            <IconButton
              icon={List}
              title="List view"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              onClick={() => setViewMode("list")}
              size="sm"
            />
            <div className="w-px h-4 bg-gray-700 mx-1" />
            <IconButton
              icon={ZoomOut}
              title="Zoom out"
              variant="ghost"
              onClick={handleZoomOut}
              size="sm"
              disabled={zoom <= 0.5}
            />
            <span className="text-xs text-gray-500 w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <IconButton
              icon={ZoomIn}
              title="Zoom in"
              variant="ghost"
              onClick={handleZoomIn}
              size="sm"
              disabled={zoom >= 2}
            />
            <IconButton
              icon={Maximize}
              title="Reset zoom"
              variant="ghost"
              onClick={handleResetZoom}
              size="sm"
            />
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {viewMode === "wall" ? (
          // Wall view - levels stacked bottom to top
          <div
            className="p-6 space-y-4"
            style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
          >
            {/* Render levels from bottom (prerequisites) to top (advanced) */}
            {[...levels].reverse().map(({ level, concepts: levelConcepts }) => (
              <div key={level} className="space-y-2">
                {/* Level label */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Level {level}
                  </span>
                  <div className="flex-1 h-px bg-gray-800" />
                </div>

                {/* Concepts in this level */}
                <div className="flex flex-wrap gap-3">
                  {levelConcepts.map((concept) => {
                    const isUnlocked = isConceptUnlocked(
                      concept,
                      brickStates,
                      conceptMap
                    );
                    const brickState = brickStates.get(concept.id);

                    return (
                      <BrickNode
                        key={concept.id}
                        concept={concept}
                        brickState={brickState}
                        isUnlocked={isUnlocked}
                        isSelected={concept.id === selectedConceptId}
                        hasCramBadge={
                          crammedConceptIds.has(concept.id) ||
                          (brickState?.metrics.cramSessionsCount ?? 0) > 0
                        }
                        onClick={() => onSelectConcept?.(concept)}
                        size="md"
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // List view
          <div className="p-4 space-y-2">
            {concepts
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((concept) => {
                const isUnlocked = isConceptUnlocked(
                  concept,
                  brickStates,
                  conceptMap
                );
                const brickState = brickStates.get(concept.id);
                const mastery = brickState?.metrics.masteryScore ?? 0;

                return (
                  <Card
                    key={concept.id}
                    variant="default"
                    padding="sm"
                    interactive
                    onClick={() => onSelectConcept?.(concept)}
                    className={
                      selectedConceptId === concept.id
                        ? "ring-2 ring-emerald-500"
                        : ""
                    }
                  >
                    <div className="flex items-center gap-3">
                      {/* Mastery indicator */}
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold"
                        style={{
                          backgroundColor:
                            mastery >= 70
                              ? "rgba(16, 185, 129, 0.2)"
                              : mastery >= 30
                                ? "rgba(245, 158, 11, 0.2)"
                                : "rgba(107, 114, 128, 0.2)",
                          color:
                            mastery >= 70
                              ? "#10b981"
                              : mastery >= 30
                                ? "#f59e0b"
                                : "#6b7280",
                        }}
                      >
                        {Math.round(mastery)}%
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-200 truncate">
                          {concept.name}
                        </h4>
                        <p className="text-xs text-gray-500 truncate">
                          {concept.description || concept.domainId}
                        </p>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1">
                        {!isUnlocked && (
                          <Badge variant="ghost" size="xs">
                            Locked
                          </Badge>
                        )}
                        {crammedConceptIds.has(concept.id) && (
                          <Badge variant="warning" size="xs">
                            Crammed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
          </div>
        )}
      </div>

      {/* Detail sidebar (if concept selected) */}
      {selectedConcept && (
        <div className="border-t border-gray-800 p-4 bg-gray-900/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-100">
                {selectedConcept.name}
              </h3>
              {selectedConcept.description && (
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                  {selectedConcept.description}
                </p>
              )}

              {/* Prerequisites */}
              {selectedConcept.prerequisiteIds.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  <span className="text-xs text-gray-500">Requires:</span>
                  {selectedConcept.prerequisiteIds.map((prereqId) => {
                    const prereq = conceptMap.get(prereqId);
                    const prereqState = brickStates.get(prereqId);
                    const prereqMastery =
                      prereqState?.metrics.masteryScore ?? 0;
                    return prereq ? (
                      <Badge
                        key={prereqId}
                        variant={prereqMastery >= 50 ? "success" : "warning"}
                        size="xs"
                      >
                        {prereq.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            {/* Action */}
            {onPracticeConcept && (
              <button
                onClick={() => onPracticeConcept(selectedConcept)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Practice
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
