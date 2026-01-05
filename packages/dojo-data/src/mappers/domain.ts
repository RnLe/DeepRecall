/**
 * Mappers: DB Row Types <-> Domain Types
 *
 * Transforms between database representation (snake_case, JSONB strings)
 * and domain types from @deeprecall/dojo-core (camelCase, parsed objects).
 *
 * Two-way mapping:
 * - toDomain: DB row -> Domain type (for reads)
 * - toRow: Domain type -> DB row (for writes)
 */

import type {
  ConceptNode,
  ConceptNodeId,
  ExerciseTemplateId,
  ExerciseVariantId,
  UserId,
  SubtaskId,
  AttemptId,
  SessionId,
  SchedulerItemId,
  ConceptBrickStateId,
  ExerciseBrickStateId,
  DomainId,
  DifficultyLevel,
  ImportanceLevel,
  ExerciseTag,
  AttemptMode,
  AttemptType,
  SubtaskResult,
  SchedulerReason,
  ExerciseSubtask,
  ExerciseTemplate,
  ExerciseVariant,
  ExerciseAttempt,
  SubtaskAttempt,
  Session,
  ConceptBrickState,
  ExerciseBrickState,
  BrickMastery,
  SchedulerItem,
  ConceptKind,
  ExerciseKind,
} from "@deeprecall/dojo-core";

import {
  asConceptNodeId,
  asExerciseTemplateId,
  asExerciseVariantId,
  asUserId,
  asSubtaskId,
  asAttemptId,
  asSessionId,
  asSchedulerItemId,
  asConceptBrickStateId,
  asExerciseBrickStateId,
} from "@deeprecall/dojo-core";

import type {
  DojoConceptNodeRow,
  DojoExerciseTemplateRow,
  DojoExerciseVariantRow,
  DojoExerciseAttemptRow,
  DojoSubtaskAttemptRow,
  DojoSessionRow,
  DojoConceptBrickRow,
  DojoExerciseBrickRow,
  DojoSchedulerItemRow,
  DbExerciseSubtask,
  DbBrickMastery,
  DbAttemptMode,
  DbAttemptType,
  DbSubtaskResult,
  DbSchedulerReason,
  DbConceptKind,
  DbExerciseKind,
} from "../types/rows";

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Parse JSONB field if it's a string
 */
function parseJsonb<T>(value: string | T | null | undefined): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value;
}

/**
 * Stringify value for JSONB storage
 */
function stringifyJsonb<T>(value: T | undefined): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

// =============================================================================
// Concept Node Mappers
// =============================================================================

/**
 * Convert DB row to ConceptNode domain type
 */
export function conceptNodeToDomain(row: DojoConceptNodeRow): ConceptNode {
  return {
    id: asConceptNodeId(row.id),
    domainId: row.domain_id as DomainId,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    conceptKind: row.concept_kind as ConceptKind,
    difficulty: row.difficulty as DifficultyLevel,
    importance: row.importance as ImportanceLevel,
    prerequisiteIds: row.prerequisite_ids.map(asConceptNodeId),
    tagIds: row.tag_ids.length > 0 ? row.tag_ids : undefined,
    relatedAnnotationIds:
      row.related_annotation_ids.length > 0
        ? row.related_annotation_ids
        : undefined,
    relatedDocumentIds:
      row.related_document_ids.length > 0
        ? row.related_document_ids
        : undefined,
    relatedBoardIds:
      row.related_board_ids.length > 0 ? row.related_board_ids : undefined,
    isGlobal: row.is_global ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert ConceptNode to DB row format
 */
export function conceptNodeToRow(
  concept: ConceptNode,
  ownerId: string
): DojoConceptNodeRow {
  return {
    id: concept.id,
    owner_id: ownerId,
    domain_id: concept.domainId,
    name: concept.name,
    slug: concept.slug,
    description: concept.description ?? null,
    concept_kind: concept.conceptKind as DbConceptKind,
    difficulty: concept.difficulty,
    importance: concept.importance,
    prerequisite_ids: concept.prerequisiteIds.map((id) => id as string),
    tag_ids: concept.tagIds ?? [],
    related_annotation_ids: concept.relatedAnnotationIds ?? [],
    related_document_ids: concept.relatedDocumentIds ?? [],
    related_board_ids: concept.relatedBoardIds ?? [],
    is_global: concept.isGlobal ?? false,
    created_at: concept.createdAt,
    updated_at: concept.updatedAt,
  };
}

// =============================================================================
// Exercise Subtask Mappers
// =============================================================================

/**
 * Convert DB subtask to domain subtask
 */
function subtaskToDomain(dbSubtask: DbExerciseSubtask): ExerciseSubtask {
  return {
    id: asSubtaskId(dbSubtask.id),
    label: dbSubtask.label,
    prompt: dbSubtask.prompt,
    hintSteps: dbSubtask.hint_steps,
    solutionSketch: dbSubtask.solution_sketch,
    fullSolution: dbSubtask.full_solution,
    relativeDifficulty: dbSubtask.relative_difficulty,
    expectedMinutes: dbSubtask.expected_minutes,
  };
}

/**
 * Convert domain subtask to DB subtask
 */
function subtaskToDb(subtask: ExerciseSubtask): DbExerciseSubtask {
  return {
    id: subtask.id,
    label: subtask.label,
    prompt: subtask.prompt,
    hint_steps: subtask.hintSteps,
    solution_sketch: subtask.solutionSketch,
    full_solution: subtask.fullSolution,
    relative_difficulty: subtask.relativeDifficulty,
    expected_minutes: subtask.expectedMinutes,
  };
}

// =============================================================================
// Exercise Template Mappers
// =============================================================================

/**
 * Convert DB row to ExerciseTemplate domain type
 */
export function exerciseTemplateToDomain(
  row: DojoExerciseTemplateRow
): ExerciseTemplate {
  const subtasksJson = parseJsonb<DbExerciseSubtask[]>(row.subtasks_json) ?? [];
  const parameterSchema = parseJsonb<Record<string, unknown>>(
    row.parameter_schema
  );

  // Handle both old (concept_ids) and new (primary_concept_ids + supporting_concept_ids) formats
  const primaryConceptIds = (
    row.primary_concept_ids ??
    row.concept_ids ??
    []
  ).map(asConceptNodeId);

  return {
    id: asExerciseTemplateId(row.id),
    domainId: row.domain_id as DomainId,
    title: row.title,
    description: row.description ?? undefined,
    problemStatement: row.problem_statement,
    subtasks: subtasksJson.map(subtaskToDomain),
    primaryConceptIds,
    supportingConceptIds: row.supporting_concept_ids?.map(asConceptNodeId),
    exerciseKind: row.exercise_kind as ExerciseKind,
    difficulty: row.difficulty as DifficultyLevel,
    importance: row.importance as ImportanceLevel,
    tags: row.tags as ExerciseTag[],
    isParameterized: row.is_parameterized,
    parameterSchema: parameterSchema,
    variantGenerationNote: row.variant_generation_note ?? undefined,
    relatedAnnotationIds:
      row.related_annotation_ids.length > 0
        ? row.related_annotation_ids
        : undefined,
    relatedDocumentIds:
      row.related_document_ids.length > 0
        ? row.related_document_ids
        : undefined,
    relatedBoardIds:
      row.related_board_ids.length > 0 ? row.related_board_ids : undefined,
    source: row.source,
    authorNotes: row.author_notes,
    isGlobal: row.is_global ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert ExerciseTemplate to DB row format
 */
export function exerciseTemplateToRow(
  template: ExerciseTemplate,
  ownerId: string
): DojoExerciseTemplateRow {
  return {
    id: template.id,
    owner_id: ownerId,
    domain_id: template.domainId,
    title: template.title,
    description: template.description ?? null,
    problem_statement: template.problemStatement,
    concept_ids: template.primaryConceptIds.map((id) => id as string),
    primary_concept_ids: template.primaryConceptIds.map((id) => id as string),
    supporting_concept_ids: template.supportingConceptIds?.map(
      (id) => id as string
    ),
    exercise_kind: template.exerciseKind as DbExerciseKind,
    difficulty: template.difficulty,
    importance: template.importance,
    tags: template.tags,
    subtasks_json: template.subtasks.map(subtaskToDb),
    is_parameterized: template.isParameterized,
    parameter_schema: template.parameterSchema ?? null,
    variant_generation_note: template.variantGenerationNote ?? null,
    related_annotation_ids: template.relatedAnnotationIds ?? [],
    related_document_ids: template.relatedDocumentIds ?? [],
    related_board_ids: template.relatedBoardIds ?? [],
    source: template.source,
    author_notes: template.authorNotes,
    is_global: template.isGlobal ?? false,
    created_at: template.createdAt,
    updated_at: template.updatedAt,
  };
}

// =============================================================================
// Exercise Variant Mappers
// =============================================================================

/**
 * Convert DB row to ExerciseVariant domain type
 */
export function exerciseVariantToDomain(
  row: DojoExerciseVariantRow
): ExerciseVariant {
  const parameterValues = parseJsonb<Record<string, unknown>>(
    row.parameter_values
  );
  const subtasksOverride = parseJsonb<DbExerciseSubtask[]>(
    row.generated_subtasks_json
  );

  return {
    id: asExerciseVariantId(row.id),
    templateId: asExerciseTemplateId(row.template_id),
    parameterValues,
    problemStatementOverride: row.problem_statement_override,
    subtasksOverride: subtasksOverride?.map(subtaskToDomain),
    generatedAt: row.generated_at,
    seed: row.seed,
  };
}

/**
 * Convert ExerciseVariant to DB row format
 */
export function exerciseVariantToRow(
  variant: ExerciseVariant,
  ownerId: string
): DojoExerciseVariantRow {
  return {
    id: variant.id,
    owner_id: ownerId,
    template_id: variant.templateId,
    parameter_values: variant.parameterValues ?? {},
    generated_subtasks_json: variant.subtasksOverride?.map(subtaskToDb) ?? null,
    problem_statement_override: variant.problemStatementOverride,
    seed: variant.seed,
    generated_at: variant.generatedAt,
    created_at: variant.generatedAt, // Use generatedAt as createdAt
  };
}

// =============================================================================
// Subtask Attempt Mappers
// =============================================================================

/**
 * Convert DB row to SubtaskAttempt domain type
 */
export function subtaskAttemptToDomain(
  row: DojoSubtaskAttemptRow
): SubtaskAttempt {
  return {
    subtaskId: asSubtaskId(row.subtask_id),
    result: row.result as SubtaskResult,
    selfRatedDifficulty: row.self_difficulty ?? undefined,
    errorTypes:
      row.error_types.length > 0
        ? (row.error_types as SubtaskAttempt["errorTypes"])
        : undefined,
    usedHints: row.used_hints,
    hintsRevealed: row.hints_revealed,
    revealedSolution: row.revealed_solution,
    timeSeconds: row.time_seconds,
    notes: row.notes,
  };
}

/**
 * Convert SubtaskAttempt to DB row format
 */
export function subtaskAttemptToRow(
  subtaskAttempt: SubtaskAttempt,
  attemptId: string,
  ownerId: string
): DojoSubtaskAttemptRow {
  return {
    id: crypto.randomUUID(),
    owner_id: ownerId,
    attempt_id: attemptId,
    subtask_id: subtaskAttempt.subtaskId,
    result: subtaskAttempt.result,
    self_difficulty: subtaskAttempt.selfRatedDifficulty ?? null,
    error_types: subtaskAttempt.errorTypes ?? [],
    used_hints: subtaskAttempt.usedHints,
    hints_revealed: subtaskAttempt.hintsRevealed,
    revealed_solution: subtaskAttempt.revealedSolution,
    time_seconds: subtaskAttempt.timeSeconds,
    notes: subtaskAttempt.notes,
  };
}

// =============================================================================
// Exercise Attempt Mappers
// =============================================================================

/**
 * Convert DB row to ExerciseAttempt domain type
 * Note: subtaskAttempts must be joined separately
 */
export function exerciseAttemptToDomain(
  row: DojoExerciseAttemptRow,
  subtaskAttempts: SubtaskAttempt[] = []
): ExerciseAttempt {
  return {
    id: asAttemptId(row.id),
    userId: asUserId(row.owner_id),
    templateId: asExerciseTemplateId(row.template_id),
    variantId: row.variant_id ? asExerciseVariantId(row.variant_id) : undefined,
    sessionId: row.session_id ? asSessionId(row.session_id) : undefined,
    mode: row.mode as AttemptMode,
    attemptType: row.attempt_type as AttemptType,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    totalSeconds: row.total_seconds,
    wasPaused: row.was_paused,
    pauseSeconds: row.pause_seconds,
    subtaskAttempts,
    completionStatus: row.completion_status,
    notes: row.notes ?? undefined,
    attachmentIds:
      row.attachment_ids.length > 0 ? row.attachment_ids : undefined,
    overallDifficulty: row.overall_difficulty,
    confidenceLevel: row.confidence_level,
    correctCount: row.correct_count,
    partialCount: row.partial_count,
    incorrectCount: row.incorrect_count,
    accuracy: row.accuracy,
  };
}

/**
 * Convert ExerciseAttempt to DB row format
 */
export function exerciseAttemptToRow(
  attempt: ExerciseAttempt
): DojoExerciseAttemptRow {
  return {
    id: attempt.id,
    owner_id: attempt.userId,
    template_id: attempt.templateId,
    variant_id: attempt.variantId ?? null,
    session_id: attempt.sessionId ?? null,
    mode: attempt.mode,
    attempt_type: attempt.attemptType,
    started_at: attempt.startedAt,
    ended_at: attempt.endedAt,
    total_seconds: attempt.totalSeconds,
    was_paused: attempt.wasPaused,
    pause_seconds: attempt.pauseSeconds,
    completion_status: attempt.completionStatus,
    hints_used: attempt.subtaskAttempts.filter((s) => s.usedHints).length,
    solution_viewed: attempt.subtaskAttempts.some((s) => s.revealedSolution),
    notes: attempt.notes ?? null,
    attachment_ids: attempt.attachmentIds ?? [],
    overall_difficulty: attempt.overallDifficulty,
    confidence_level: attempt.confidenceLevel,
    correct_count: attempt.correctCount,
    partial_count: attempt.partialCount,
    incorrect_count: attempt.incorrectCount,
    accuracy: attempt.accuracy,
    created_at: attempt.startedAt,
  };
}

// =============================================================================
// Session Mappers
// =============================================================================

/**
 * Convert DB row to Session domain type
 */
export function sessionToDomain(row: DojoSessionRow): Session {
  return {
    id: asSessionId(row.id),
    userId: asUserId(row.owner_id),
    mode: row.mode as AttemptMode,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    plannedDurationMinutes: row.planned_duration_minutes ?? undefined,
    actualDurationSeconds: row.actual_duration_seconds ?? undefined,
    targetConceptIds:
      row.target_concept_ids.length > 0
        ? row.target_concept_ids.map(asConceptNodeId)
        : undefined,
    targetExerciseIds:
      row.target_exercise_ids.length > 0
        ? row.target_exercise_ids.map(asExerciseTemplateId)
        : undefined,
    attemptIds: row.attempt_ids.map(asAttemptId),
    exercisesCompleted: row.exercises_completed,
    exercisesPlanned: row.exercises_planned ?? undefined,
    reflectionNote: row.reflection_note ?? undefined,
    startMoodRating: row.start_mood_rating ?? undefined,
    endMoodRating: row.end_mood_rating ?? undefined,
    sessionDifficulty: row.session_difficulty ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert Session to DB row format
 */
export function sessionToRow(session: Session): DojoSessionRow {
  return {
    id: session.id,
    owner_id: session.userId,
    mode: session.mode,
    started_at: session.startedAt,
    ended_at: session.endedAt ?? null,
    planned_duration_minutes: session.plannedDurationMinutes ?? null,
    actual_duration_seconds: session.actualDurationSeconds ?? null,
    target_concept_ids:
      session.targetConceptIds?.map((id) => id as string) ?? [],
    target_exercise_ids:
      session.targetExerciseIds?.map((id) => id as string) ?? [],
    attempt_ids: session.attemptIds.map((id) => id as string),
    exercises_completed: session.exercisesCompleted,
    exercises_planned: session.exercisesPlanned ?? null,
    reflection_note: session.reflectionNote ?? null,
    start_mood_rating: session.startMoodRating ?? null,
    end_mood_rating: session.endMoodRating ?? null,
    session_difficulty: session.sessionDifficulty ?? null,
    status: session.status,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };
}

// =============================================================================
// Brick Mastery Mappers
// =============================================================================

/**
 * Convert DB metrics to BrickMastery domain type
 */
function brickMasteryToDomain(metrics: DbBrickMastery): BrickMastery {
  return {
    masteryScore: metrics.mastery_score,
    stabilityScore: metrics.stability_score,
    avgAccuracy: metrics.avg_accuracy,
    medianTimeSeconds: metrics.median_time_seconds,
    bestTimeSeconds: metrics.best_time_seconds,
    worstTimeSeconds: metrics.worst_time_seconds,
    lastPracticedAt: metrics.last_practiced_at,
    totalAttempts: metrics.total_attempts,
    totalVariants: metrics.total_variants,
    cramSessionsCount: metrics.cram_sessions_count,
    correctStreak: metrics.correct_streak,
    trend: metrics.trend,
    masteredAt: metrics.mastered_at,
  };
}

/**
 * Convert BrickMastery to DB metrics format
 */
function brickMasteryToDb(mastery: BrickMastery): DbBrickMastery {
  return {
    mastery_score: mastery.masteryScore,
    stability_score: mastery.stabilityScore,
    avg_accuracy: mastery.avgAccuracy,
    median_time_seconds: mastery.medianTimeSeconds,
    best_time_seconds: mastery.bestTimeSeconds,
    worst_time_seconds: mastery.worstTimeSeconds,
    last_practiced_at: mastery.lastPracticedAt,
    total_attempts: mastery.totalAttempts,
    total_variants: mastery.totalVariants,
    cram_sessions_count: mastery.cramSessionsCount,
    correct_streak: mastery.correctStreak,
    trend: mastery.trend,
    mastered_at: mastery.masteredAt,
  };
}

// =============================================================================
// Concept Brick State Mappers
// =============================================================================

/**
 * Convert DB row to ConceptBrickState domain type
 */
export function conceptBrickToDomain(
  row: DojoConceptBrickRow
): ConceptBrickState {
  const metrics = parseJsonb<DbBrickMastery>(row.metrics);

  if (!metrics) {
    throw new Error(`Invalid metrics JSONB for concept brick ${row.id}`);
  }

  return {
    id: asConceptBrickStateId(row.id),
    userId: asUserId(row.owner_id),
    conceptId: asConceptNodeId(row.concept_id),
    metrics: brickMasteryToDomain(metrics),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert ConceptBrickState to DB row format
 */
export function conceptBrickToRow(
  brick: ConceptBrickState
): DojoConceptBrickRow {
  return {
    id: brick.id,
    owner_id: brick.userId,
    concept_id: brick.conceptId,
    metrics: brickMasteryToDb(brick.metrics),
    created_at: brick.createdAt,
    updated_at: brick.updatedAt,
  };
}

// =============================================================================
// Exercise Brick State Mappers
// =============================================================================

/**
 * Convert DB row to ExerciseBrickState domain type
 */
export function exerciseBrickToDomain(
  row: DojoExerciseBrickRow
): ExerciseBrickState {
  const metrics = parseJsonb<DbBrickMastery>(row.metrics);

  if (!metrics) {
    throw new Error(`Invalid metrics JSONB for exercise brick ${row.id}`);
  }

  return {
    id: asExerciseBrickStateId(row.id),
    userId: asUserId(row.owner_id),
    templateId: asExerciseTemplateId(row.template_id),
    metrics: brickMasteryToDomain(metrics),
    recentAttemptIds:
      row.recent_attempt_ids.length > 0 ? row.recent_attempt_ids : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert ExerciseBrickState to DB row format
 */
export function exerciseBrickToRow(
  brick: ExerciseBrickState
): DojoExerciseBrickRow {
  return {
    id: brick.id,
    owner_id: brick.userId,
    template_id: brick.templateId,
    metrics: brickMasteryToDb(brick.metrics),
    recent_attempt_ids: brick.recentAttemptIds ?? [],
    created_at: brick.createdAt,
    updated_at: brick.updatedAt,
  };
}

// =============================================================================
// Scheduler Item Mappers
// =============================================================================

/**
 * Convert DB row to SchedulerItem domain type
 */
export function schedulerItemToDomain(
  row: DojoSchedulerItemRow
): SchedulerItem {
  return {
    id: asSchedulerItemId(row.id),
    userId: asUserId(row.owner_id),
    templateId: asExerciseTemplateId(row.template_id),
    variantId: row.variant_id ? asExerciseVariantId(row.variant_id) : undefined,
    scheduledFor: row.scheduled_for,
    reason: row.reason as SchedulerReason,
    recommendedMode: row.recommended_mode as AttemptMode,
    priority: row.priority,
    completed: row.completed,
    completedAt: row.completed_at ?? undefined,
    completedByAttemptId: row.completed_by_attempt_id ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Convert SchedulerItem to DB row format
 */
export function schedulerItemToRow(item: SchedulerItem): DojoSchedulerItemRow {
  return {
    id: item.id,
    owner_id: item.userId,
    template_id: item.templateId,
    variant_id: item.variantId ?? null,
    scheduled_for: item.scheduledFor,
    reason: item.reason,
    recommended_mode: item.recommendedMode,
    priority: item.priority,
    completed: item.completed,
    completed_at: item.completedAt ?? null,
    completed_by_attempt_id: item.completedByAttemptId ?? null,
    created_at: item.createdAt,
  };
}
