/**
 * useConceptSuggestions - Suggest new exercises based on concept graph
 * Uses DAG structure to recommend exercises for unlocked concepts
 */

"use client";

import { useMemo } from "react";
import type {
  ExerciseTemplate,
  ConceptNode,
  ConceptBrickState,
  ExerciseBrickState,
  SchedulerItem,
  ConceptNodeId,
} from "@deeprecall/dojo-core";
import {
  computeLevels,
  buildPrerequisiteMap,
  topologicalSort,
} from "@deeprecall/dojo-core";

export interface SuggestedExercise {
  /** The exercise template */
  exercise: ExerciseTemplate;
  /** Why this exercise is suggested */
  reason: "unlocked" | "next_level" | "strengthen_weak" | "explore_new";
  /** The primary concept this helps with */
  primaryConcept?: ConceptNode;
  /** Suggestion priority (higher = more relevant) */
  suggestionScore: number;
  /** Whether the user has never attempted this */
  isNew: boolean;
}

export interface UseConceptSuggestionsOptions {
  /** All exercises */
  exercises: ExerciseTemplate[];
  /** All concepts */
  concepts: ConceptNode[];
  /** Concept brick states */
  conceptBricks: Map<string, ConceptBrickState>;
  /** Exercise brick states */
  exerciseBricks: Map<string, ExerciseBrickState>;
  /** Current scheduler items (to exclude already scheduled) */
  schedulerItems: SchedulerItem[];
  /** Maximum suggestions to return */
  maxSuggestions?: number;
  /** Mastery threshold to consider a concept "mastered" (0-100) */
  masteryThreshold?: number;
}

export interface UseConceptSuggestionsResult {
  /** Suggested exercises, sorted by relevance */
  suggestions: SuggestedExercise[];
  /** Concepts that are unlocked (prerequisites mastered) but not yet started */
  unlockedConcepts: ConceptNode[];
  /** Concepts that are weak and need strengthening */
  weakConcepts: ConceptNode[];
  /** Next level concepts (one hop from current mastered set) */
  nextLevelConcepts: ConceptNode[];
}

/**
 * Hook that suggests exercises based on concept graph analysis
 */
export function useConceptSuggestions({
  exercises,
  concepts,
  conceptBricks,
  exerciseBricks,
  schedulerItems,
  maxSuggestions = 5,
  masteryThreshold = 70,
}: UseConceptSuggestionsOptions): UseConceptSuggestionsResult {
  // Build concept map for quick lookup
  const conceptMap = useMemo(
    () => new Map(concepts.map((c) => [c.id, c])),
    [concepts]
  );

  // Build prerequisite map
  const prereqMap = useMemo(() => buildPrerequisiteMap(concepts), [concepts]);

  // Compute concept levels in the DAG
  const conceptLevels = useMemo(() => computeLevels(concepts), [concepts]);

  // Get currently scheduled template IDs (as strings for comparison)
  const scheduledTemplateIds = useMemo(
    () =>
      new Set(
        schedulerItems
          .filter((s) => !s.completedAt)
          .map((s) => s.templateId as string)
      ),
    [schedulerItems]
  );

  // Categorize concepts by mastery status
  const { masteredConcepts, weakConcepts, untriedConcepts } = useMemo(() => {
    const mastered: ConceptNode[] = [];
    const weak: ConceptNode[] = [];
    const untried: ConceptNode[] = [];

    for (const concept of concepts) {
      const brickState = conceptBricks.get(concept.id);

      if (!brickState || brickState.metrics.totalAttempts === 0) {
        untried.push(concept);
      } else if (brickState.metrics.masteryScore >= masteryThreshold) {
        mastered.push(concept);
      } else if (brickState.metrics.masteryScore < 50) {
        weak.push(concept);
      }
    }

    return {
      masteredConcepts: mastered,
      weakConcepts: weak,
      untriedConcepts: untried,
    };
  }, [concepts, conceptBricks, masteryThreshold]);

  // Find unlocked concepts (prerequisites mastered but concept not yet mastered)
  const unlockedConcepts = useMemo(() => {
    const masteredIds = new Set(masteredConcepts.map((c) => c.id as string));

    return untriedConcepts.filter((concept) => {
      const prereqs = prereqMap.get(concept.id as string) ?? new Set<string>();
      // All prerequisites must be mastered (or no prerequisites)
      if (prereqs.size === 0) return true;
      return [...prereqs].every((prereqId) => masteredIds.has(prereqId));
    });
  }, [untriedConcepts, masteredConcepts, prereqMap]);

  // Find next level concepts (one level above current mastered)
  const nextLevelConcepts = useMemo(() => {
    const masteredIds = new Set(masteredConcepts.map((c) => c.id as string));
    const maxMasteredLevel = Math.max(
      0,
      ...masteredConcepts.map((c) => conceptLevels.get(c.id as string) ?? 0)
    );

    // Get concepts at the next level that have at least one mastered prerequisite
    return concepts.filter((concept) => {
      const level = conceptLevels.get(concept.id as string) ?? 0;
      if (level > maxMasteredLevel + 1) return false;
      if (masteredIds.has(concept.id as string)) return false;

      const prereqs = prereqMap.get(concept.id as string) ?? new Set<string>();
      return (
        prereqs.size === 0 ||
        [...prereqs].some((prereqId) => masteredIds.has(prereqId))
      );
    });
  }, [concepts, masteredConcepts, conceptLevels, prereqMap]);

  // Build exercise-to-concept mapping
  const exercisesByConceptId = useMemo(() => {
    const map = new Map<string, ExerciseTemplate[]>();

    for (const exercise of exercises) {
      // Group by primary and supporting concepts
      const allConceptIds = [
        ...(exercise.primaryConceptIds ?? []),
        ...(exercise.supportingConceptIds ?? []),
      ] as string[];

      for (const conceptId of allConceptIds) {
        const existing = map.get(conceptId) ?? [];
        existing.push(exercise);
        map.set(conceptId, existing);
      }
    }

    return map;
  }, [exercises]);

  // Generate suggestions
  const suggestions = useMemo(() => {
    const suggestions: SuggestedExercise[] = [];

    // Helper to add exercise suggestion
    const addSuggestion = (
      exercise: ExerciseTemplate,
      reason: SuggestedExercise["reason"],
      concept: ConceptNode | undefined,
      baseScore: number
    ) => {
      // Skip if already scheduled
      if (scheduledTemplateIds.has(exercise.id as string)) return;

      // Skip if already in suggestions
      if (suggestions.some((s) => s.exercise.id === exercise.id)) return;

      const brickState = exerciseBricks.get(exercise.id as string);
      const isNew = !brickState || brickState.metrics.totalAttempts === 0;

      // Adjust score based on exercise properties
      let score = baseScore;
      if (isNew) score += 10; // Prefer new exercises

      // Prefer easier exercises for new concepts
      if (reason === "unlocked" || reason === "explore_new") {
        // Map difficulty to number: intro=0, core=1, advanced=2
        const difficultyScore =
          exercise.difficulty === "intro"
            ? 0
            : exercise.difficulty === "core"
              ? 1
              : 2;
        score += (2 - difficultyScore) * 5; // Easier = higher score
      }

      suggestions.push({
        exercise,
        reason,
        primaryConcept: concept,
        suggestionScore: score,
        isNew,
      });
    };

    // 1. Suggest exercises for unlocked concepts (highest priority)
    for (const concept of unlockedConcepts) {
      const conceptExercises =
        exercisesByConceptId.get(concept.id as string) ?? [];
      for (const exercise of conceptExercises.slice(0, 2)) {
        addSuggestion(exercise, "unlocked", concept, 100);
      }
    }

    // 2. Suggest exercises for weak concepts (to strengthen)
    for (const concept of weakConcepts) {
      const conceptExercises =
        exercisesByConceptId.get(concept.id as string) ?? [];
      for (const exercise of conceptExercises.slice(0, 1)) {
        addSuggestion(exercise, "strengthen_weak", concept, 80);
      }
    }

    // 3. Suggest exercises for next level concepts
    for (const concept of nextLevelConcepts) {
      const conceptExercises =
        exercisesByConceptId.get(concept.id as string) ?? [];
      for (const exercise of conceptExercises.slice(0, 1)) {
        addSuggestion(exercise, "next_level", concept, 60);
      }
    }

    // 4. Suggest any new exercises not yet attempted (exploration)
    const newExercises = exercises.filter((ex) => {
      const brickState = exerciseBricks.get(ex.id as string);
      return !brickState || brickState.metrics.totalAttempts === 0;
    });

    for (const exercise of newExercises.slice(0, 3)) {
      const primaryConceptId = exercise.primaryConceptIds?.[0];
      const concept = primaryConceptId
        ? conceptMap.get(primaryConceptId)
        : undefined;
      addSuggestion(exercise, "explore_new", concept, 40);
    }

    // Sort by suggestion score and limit
    return suggestions
      .sort((a, b) => b.suggestionScore - a.suggestionScore)
      .slice(0, maxSuggestions);
  }, [
    unlockedConcepts,
    weakConcepts,
    nextLevelConcepts,
    exercises,
    exercisesByConceptId,
    exerciseBricks,
    scheduledTemplateIds,
    conceptMap,
    maxSuggestions,
  ]);

  return {
    suggestions,
    unlockedConcepts,
    weakConcepts,
    nextLevelConcepts,
  };
}
