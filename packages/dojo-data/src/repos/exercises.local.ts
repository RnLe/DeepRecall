/**
 * Exercises Local Repository (Optimistic Layer)
 *
 * Instant writes to Dexie, queued for background sync via WriteBuffer.
 * Handles both ExerciseTemplates and ExerciseVariants.
 */

import type {
  ExerciseTemplate,
  ExerciseTemplateCreate,
  ExerciseTemplateId,
  ExerciseVariant,
  ExerciseVariantCreate,
  ExerciseVariantId,
} from "@deeprecall/dojo-core";
import {
  asExerciseTemplateId,
  asExerciseVariantId,
} from "@deeprecall/dojo-core";
import { createWriteBuffer, isAuthenticated } from "@deeprecall/data";
import { logger } from "@deeprecall/telemetry";
import { dojoDb } from "../db";
import { exerciseTemplateToRow, exerciseVariantToRow } from "../mappers";
import type {
  DojoExerciseTemplateRow,
  DojoExerciseVariantRow,
} from "../types/rows";

const buffer = createWriteBuffer();

// =============================================================================
// Exercise Template Local Operations
// =============================================================================

/**
 * Create a new exercise template (instant local write)
 */
export async function createExerciseTemplateLocal(
  input: ExerciseTemplateCreate,
  ownerId: string
): Promise<ExerciseTemplate> {
  const now = new Date().toISOString();
  const id = asExerciseTemplateId(crypto.randomUUID());

  const template: ExerciseTemplate = {
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
  };

  const row = exerciseTemplateToRow(template, ownerId);

  // Write to local table (instant)
  await dojoDb.dojo_exercise_templates_local.add({
    id: template.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: row,
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_exercise_templates",
      op: "insert",
      payload: row,
    });
  }

  logger.info("db.local", "Created exercise template (pending sync)", {
    templateId: id,
    title: input.title,
    domainId: input.domainId,
    willSync: isAuthenticated(),
  });

  return template;
}

/**
 * Update an exercise template (instant local write)
 */
export async function updateExerciseTemplateLocal(
  id: ExerciseTemplateId,
  updates: Partial<Omit<ExerciseTemplate, "id" | "createdAt">>,
  ownerId: string
): Promise<void> {
  const now = new Date().toISOString();

  // Convert to snake_case for DB
  const payload: Partial<DojoExerciseTemplateRow> & {
    id: string;
    owner_id: string;
  } = {
    id,
    owner_id: ownerId,
    updated_at: now,
  };

  // Map camelCase to snake_case
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined)
    payload.description = updates.description ?? null;
  if (updates.problemStatement !== undefined)
    payload.problem_statement = updates.problemStatement;
  if (updates.domainId !== undefined) payload.domain_id = updates.domainId;
  if (updates.difficulty !== undefined) payload.difficulty = updates.difficulty;
  if (updates.importance !== undefined) payload.importance = updates.importance;
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (updates.subtasks !== undefined) {
    payload.subtasks_json = updates.subtasks.map((s) => ({
      id: s.id,
      label: s.label,
      prompt: s.prompt,
      hint_steps: s.hintSteps,
      solution_sketch: s.solutionSketch,
      full_solution: s.fullSolution,
      relative_difficulty: s.relativeDifficulty,
      expected_minutes: s.expectedMinutes,
    }));
  }
  if (updates.primaryConceptIds !== undefined) {
    payload.concept_ids = updates.primaryConceptIds.map((cid) => cid as string);
    payload.primary_concept_ids = updates.primaryConceptIds.map(
      (cid) => cid as string
    );
  }
  if (updates.supportingConceptIds !== undefined) {
    payload.supporting_concept_ids = updates.supportingConceptIds?.map(
      (cid) => cid as string
    );
  }
  if (updates.isParameterized !== undefined)
    payload.is_parameterized = updates.isParameterized;
  if (updates.parameterSchema !== undefined)
    payload.parameter_schema = updates.parameterSchema ?? null;
  if (updates.variantGenerationNote !== undefined) {
    payload.variant_generation_note = updates.variantGenerationNote ?? null;
  }
  if (updates.source !== undefined) payload.source = updates.source;
  if (updates.authorNotes !== undefined)
    payload.author_notes = updates.authorNotes;
  if (updates.relatedAnnotationIds !== undefined) {
    payload.related_annotation_ids = updates.relatedAnnotationIds ?? [];
  }
  if (updates.relatedDocumentIds !== undefined) {
    payload.related_document_ids = updates.relatedDocumentIds ?? [];
  }
  if (updates.relatedBoardIds !== undefined) {
    payload.related_board_ids = updates.relatedBoardIds ?? [];
  }

  // Write to local table (instant)
  await dojoDb.dojo_exercise_templates_local.add({
    id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: payload as DojoExerciseTemplateRow,
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_exercise_templates",
      op: "update",
      payload,
    });
  }

  logger.info("db.local", "Updated exercise template (pending sync)", {
    templateId: id,
    willSync: isAuthenticated(),
  });
}

/**
 * Delete an exercise template (instant local write)
 */
export async function deleteExerciseTemplateLocal(
  id: ExerciseTemplateId,
  ownerId: string
): Promise<void> {
  // Write to local table (instant)
  await dojoDb.dojo_exercise_templates_local.add({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_exercise_templates",
      op: "delete",
      payload: { id, owner_id: ownerId },
    });
  }

  logger.info("db.local", "Deleted exercise template (pending sync)", {
    templateId: id,
    willSync: isAuthenticated(),
  });
}

// =============================================================================
// Exercise Variant Local Operations
// =============================================================================

/**
 * Create a new exercise variant (instant local write)
 */
export async function createExerciseVariantLocal(
  input: ExerciseVariantCreate,
  ownerId: string
): Promise<ExerciseVariant> {
  const now = new Date().toISOString();
  const id = asExerciseVariantId(crypto.randomUUID());

  const variant: ExerciseVariant = {
    ...input,
    id,
    generatedAt: now,
  };

  const row = exerciseVariantToRow(variant, ownerId);

  // Write to local table (instant)
  await dojoDb.dojo_exercise_variants_local.add({
    id: variant.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: row,
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_exercise_variants",
      op: "insert",
      payload: row,
    });
  }

  logger.info("db.local", "Created exercise variant (pending sync)", {
    variantId: id,
    templateId: input.templateId,
    willSync: isAuthenticated(),
  });

  return variant;
}

/**
 * Delete an exercise variant (instant local write)
 */
export async function deleteExerciseVariantLocal(
  id: ExerciseVariantId,
  ownerId: string
): Promise<void> {
  // Write to local table (instant)
  await dojoDb.dojo_exercise_variants_local.add({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_exercise_variants",
      op: "delete",
      payload: { id, owner_id: ownerId },
    });
  }

  logger.info("db.local", "Deleted exercise variant (pending sync)", {
    variantId: id,
    willSync: isAuthenticated(),
  });
}
