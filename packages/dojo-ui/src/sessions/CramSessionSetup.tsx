/**
 * CramSessionSetup - UI for configuring and starting a cram session
 *
 * Features:
 * - Target concept/exercise selection
 * - Duration picker
 * - Mood rating (optional)
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Zap,
  Clock,
  Target,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type {
  ConceptNode,
  ExerciseTemplate,
  ConceptNodeId,
  ExerciseTemplateId,
  ConceptBrickState,
  ExerciseBrickState,
} from "@deeprecall/dojo-core";
import { DOMAIN_LABELS } from "@deeprecall/dojo-core";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { ProgressRing } from "../components/ProgressRing";

export interface CramSessionSetupProps {
  /** All available concepts */
  concepts: ConceptNode[];
  /** All available exercises */
  exercises: ExerciseTemplate[];
  /** Concept brick states (for mastery display) */
  conceptBricks: Map<string, ConceptBrickState>;
  /** Exercise brick states (for mastery display) */
  exerciseBricks: Map<string, ExerciseBrickState>;
  /** Callback to start the cram session */
  onStart: (config: CramSessionConfig) => void;
  /** Callback to cancel */
  onCancel: () => void;
}

export interface CramSessionConfig {
  targetConceptIds: ConceptNodeId[];
  targetExerciseIds: ExerciseTemplateId[];
  durationMinutes: number;
  moodRating?: number;
}

const DURATION_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

/**
 * Cram session setup screen
 */
export function CramSessionSetup({
  concepts,
  exercises,
  conceptBricks,
  exerciseBricks,
  onStart,
  onCancel,
}: CramSessionSetupProps) {
  const [selectedConceptIds, setSelectedConceptIds] = useState<Set<string>>(
    new Set()
  );
  const [duration, setDuration] = useState(30);
  const [moodRating, setMoodRating] = useState<number | undefined>();
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  // Group concepts by domain
  const conceptsByDomain = useMemo(() => {
    const grouped = new Map<string, ConceptNode[]>();
    for (const concept of concepts) {
      const list = grouped.get(concept.domainId) || [];
      list.push(concept);
      grouped.set(concept.domainId, list);
    }
    return grouped;
  }, [concepts]);

  // Get exercises for selected concepts
  const relevantExercises = useMemo(() => {
    if (selectedConceptIds.size === 0) return [];
    return exercises.filter((ex) => {
      const allConceptIds = [
        ...ex.primaryConceptIds,
        ...(ex.supportingConceptIds ?? []),
      ];
      return allConceptIds.some((cid) => selectedConceptIds.has(cid));
    });
  }, [exercises, selectedConceptIds]);

  // Toggle concept selection
  const toggleConcept = useCallback((conceptId: string) => {
    setSelectedConceptIds((prev) => {
      const next = new Set(prev);
      if (next.has(conceptId)) {
        next.delete(conceptId);
      } else {
        next.add(conceptId);
      }
      return next;
    });
  }, []);

  // Select all concepts in a domain
  const selectDomain = useCallback(
    (domainId: string) => {
      const domainConcepts = conceptsByDomain.get(domainId) || [];
      setSelectedConceptIds((prev) => {
        const next = new Set(prev);
        for (const concept of domainConcepts) {
          next.add(concept.id);
        }
        return next;
      });
    },
    [conceptsByDomain]
  );

  // Deselect all concepts in a domain
  const deselectDomain = useCallback(
    (domainId: string) => {
      const domainConcepts = conceptsByDomain.get(domainId) || [];
      setSelectedConceptIds((prev) => {
        const next = new Set(prev);
        for (const concept of domainConcepts) {
          next.delete(concept.id);
        }
        return next;
      });
    },
    [conceptsByDomain]
  );

  // Start the session
  const handleStart = useCallback(() => {
    const config: CramSessionConfig = {
      targetConceptIds: Array.from(selectedConceptIds) as ConceptNodeId[],
      targetExerciseIds: relevantExercises.map((ex) => ex.id),
      durationMinutes: duration,
      moodRating,
    };
    onStart(config);
  }, [selectedConceptIds, relevantExercises, duration, moodRating, onStart]);

  const canStart = selectedConceptIds.size > 0 && relevantExercises.length > 0;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-100">
                  Cram Session
                </h1>
                <p className="text-sm text-gray-500">
                  Intensive practice on selected topics
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X size={18} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {/* Duration selector */}
          <Card variant="default" padding="md">
            <div className="flex items-center gap-3 mb-4">
              <Clock size={18} className="text-gray-400" />
              <h3 className="font-medium text-gray-200">Session Duration</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDuration(opt.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    duration === opt.value
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Concept selection */}
          <Card variant="default" padding="md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Target size={18} className="text-gray-400" />
                <h3 className="font-medium text-gray-200">Target Concepts</h3>
              </div>
              <Badge variant="default" size="sm">
                {selectedConceptIds.size} selected
              </Badge>
            </div>

            <div className="space-y-2">
              {Array.from(conceptsByDomain.entries()).map(
                ([domainId, domainConcepts]) => {
                  const isExpanded = expandedDomain === domainId;
                  const selectedInDomain = domainConcepts.filter((c) =>
                    selectedConceptIds.has(c.id)
                  ).length;
                  const allSelected =
                    selectedInDomain === domainConcepts.length;

                  return (
                    <div
                      key={domainId}
                      className="border border-gray-800 rounded-lg overflow-hidden"
                    >
                      {/* Domain header */}
                      <button
                        onClick={() =>
                          setExpandedDomain(isExpanded ? null : domainId)
                        }
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/50 hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-200">
                            {DOMAIN_LABELS[domainId] || domainId}
                          </span>
                          <Badge variant="default" size="xs">
                            {selectedInDomain}/{domainConcepts.length}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              allSelected
                                ? deselectDomain(domainId)
                                : selectDomain(domainId);
                            }}
                            className={`text-xs px-2 py-1 rounded transition-colors ${
                              allSelected
                                ? "text-amber-400 hover:text-amber-300"
                                : "text-gray-500 hover:text-gray-400"
                            }`}
                          >
                            {allSelected ? "Deselect all" : "Select all"}
                          </button>
                          {isExpanded ? (
                            <ChevronUp size={18} className="text-gray-500" />
                          ) : (
                            <ChevronDown size={18} className="text-gray-500" />
                          )}
                        </div>
                      </button>

                      {/* Concepts list */}
                      {isExpanded && (
                        <div className="p-3 space-y-1.5 bg-gray-900/50">
                          {domainConcepts.map((concept) => {
                            const isSelected = selectedConceptIds.has(
                              concept.id
                            );
                            const brick = conceptBricks.get(concept.id);
                            const mastery = brick?.metrics.masteryScore ?? 0;

                            return (
                              <button
                                key={concept.id}
                                onClick={() => toggleConcept(concept.id)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                                  isSelected
                                    ? "bg-amber-500/10 border border-amber-500/20"
                                    : "bg-gray-800/50 border border-transparent hover:border-gray-700"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-5 h-5 rounded flex items-center justify-center border ${
                                      isSelected
                                        ? "bg-amber-500 border-amber-400"
                                        : "border-gray-600"
                                    }`}
                                  >
                                    {isSelected && (
                                      <CheckCircle
                                        size={14}
                                        className="text-gray-900"
                                      />
                                    )}
                                  </div>
                                  <span
                                    className={`text-sm ${
                                      isSelected
                                        ? "text-gray-200"
                                        : "text-gray-400"
                                    }`}
                                  >
                                    {concept.name}
                                  </span>
                                </div>
                                <ProgressRing
                                  value={mastery}
                                  size={28}
                                  strokeWidth={3}
                                />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </Card>

          {/* Preview */}
          {selectedConceptIds.size > 0 && (
            <Card variant="outlined" padding="md" className="bg-gray-800/30">
              <h4 className="text-sm font-medium text-gray-400 mb-3">
                Session Preview
              </h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-semibold text-gray-100">
                    {selectedConceptIds.size}
                  </div>
                  <div className="text-xs text-gray-500">concepts</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-gray-100">
                    {relevantExercises.length}
                  </div>
                  <div className="text-xs text-gray-500">exercises</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-gray-100">
                    {duration}m
                  </div>
                  <div className="text-xs text-gray-500">duration</div>
                </div>
              </div>
            </Card>
          )}

          {/* Mood rating (optional) */}
          <Card variant="default" padding="md">
            <h4 className="text-sm font-medium text-gray-400 mb-3">
              How are you feeling? (optional)
            </h4>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() =>
                    setMoodRating(moodRating === rating ? undefined : rating)
                  }
                  className={`flex-1 py-3 rounded-lg text-lg transition-colors ${
                    moodRating === rating
                      ? "bg-amber-500/20 border border-amber-500/30"
                      : "bg-gray-800 border border-gray-700 hover:border-gray-600"
                  }`}
                >
                  {rating === 1
                    ? "😫"
                    : rating === 2
                      ? "😕"
                      : rating === 3
                        ? "😐"
                        : rating === 4
                          ? "🙂"
                          : "😊"}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </main>

      {/* Footer with start button */}
      <footer className="sticky bottom-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!canStart}
              onClick={handleStart}
              iconLeft={<Zap size={18} />}
            >
              Start Cram Session
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
