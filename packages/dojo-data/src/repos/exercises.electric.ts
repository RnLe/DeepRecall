/**
 * Exercises Electric Repository
 *
 * Read-path: Electric shapes syncing from Postgres
 * Write-path: WriteBuffer queue → /api/writes/batch → Postgres → Electric
 */

import type {
  ExerciseTemplate,
  ExerciseTemplateCreate,
  ExerciseTemplateId,
  ExerciseVariant,
  ExerciseVariantCreate,
  ExerciseVariantId,
  ConceptNodeId,
} from "@deeprecall/dojo-core";
import {
  asExerciseTemplateId,
  asExerciseVariantId,
} from "@deeprecall/dojo-core";
import { useShape, createWriteBuffer } from "@deeprecall/data";
import { logger } from "@deeprecall/telemetry";
import type {
  DojoExerciseTemplateRow,
  DojoExerciseVariantRow,
} from "../types/rows";
import {
  exerciseTemplateToDomain,
  exerciseTemplateToRow,
  exerciseVariantToDomain,
  exerciseVariantToRow,
} from "../mappers";

// =============================================================================
// Electric Read Hooks - Templates
// =============================================================================

/**
 * React hook to get all exercise templates (live-synced from Postgres)
 * Includes both user-owned content and global content (is_global = true)
 * @param userId - Owner filter for multi-tenant isolation
 */
export function useExerciseTemplates(userId?: string) {
  // Include both user's own content AND global content
  const whereClause = userId
    ? `(owner_id = '${userId}' OR is_global = true)`
    : undefined;

  const result = useShape<DojoExerciseTemplateRow>({
    table: "dojo_exercise_templates",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.map(exerciseTemplateToDomain),
  };
}

/**
 * React hook to get exercise templates by domain
 * Includes both user-owned content and global content (is_global = true)
 */
export function useExerciseTemplatesByDomain(
  domainId: string,
  userId?: string
) {
  // Include both user's own content AND global content for the domain
  const whereClause = userId
    ? `(owner_id = '${userId}' OR is_global = true) AND domain_id = '${domainId}'`
    : `domain_id = '${domainId}'`;

  const result = useShape<DojoExerciseTemplateRow>({
    table: "dojo_exercise_templates",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.map(exerciseTemplateToDomain),
  };
}

/**
 * React hook to get a single exercise template by ID
 */
export function useExerciseTemplate(id: ExerciseTemplateId | undefined) {
  const result = useShape<DojoExerciseTemplateRow>({
    table: "dojo_exercise_templates",
    where: id ? `id = '${id}'` : undefined,
  });

  return {
    ...result,
    data: result.data?.[0]
      ? exerciseTemplateToDomain(result.data[0])
      : undefined,
  };
}

/**
 * React hook to get exercise templates by concept IDs
 * Includes both user-owned content and global content (is_global = true)
 * Note: Uses PostgreSQL array overlap operator
 */
export function useExerciseTemplatesByConcepts(
  conceptIds: ConceptNodeId[],
  userId?: string
) {
  // Build array literal for PostgreSQL
  const arrayLiteral = `'{${conceptIds.join(",")}}'`;
  // Include both user's own content AND global content
  const whereClause = userId
    ? `(owner_id = '${userId}' OR is_global = true) AND concept_ids && ${arrayLiteral}`
    : `concept_ids && ${arrayLiteral}`;

  const result = useShape<DojoExerciseTemplateRow>({
    table: "dojo_exercise_templates",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.map(exerciseTemplateToDomain),
  };
}

// =============================================================================
// Electric Read Hooks - Variants
// =============================================================================

/**
 * React hook to get variants for a template
 */
export function useExerciseVariants(
  templateId: ExerciseTemplateId | undefined
) {
  const result = useShape<DojoExerciseVariantRow>({
    table: "dojo_exercise_variants",
    where: templateId ? `template_id = '${templateId}'` : undefined,
  });

  return {
    ...result,
    data: result.data?.map(exerciseVariantToDomain),
  };
}

/**
 * React hook to get a single exercise variant by ID
 */
export function useExerciseVariant(id: ExerciseVariantId | undefined) {
  const result = useShape<DojoExerciseVariantRow>({
    table: "dojo_exercise_variants",
    where: id ? `id = '${id}'` : undefined,
  });

  return {
    ...result,
    data: result.data?.[0]
      ? exerciseVariantToDomain(result.data[0])
      : undefined,
  };
}

// =============================================================================
// Write Operations - Templates
// =============================================================================

const buffer = createWriteBuffer();

/**
 * Create a new exercise template
 */
export async function createExerciseTemplate(
  data: ExerciseTemplateCreate,
  ownerId: string
): Promise<ExerciseTemplate> {
  const now = new Date().toISOString();
  const id = asExerciseTemplateId(crypto.randomUUID());

  const template: ExerciseTemplate = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  const row = exerciseTemplateToRow(template, ownerId);

  await buffer.enqueue({
    table: "dojo_exercise_templates",
    op: "insert",
    payload: row,
  });

  logger.info("db.local", "Created exercise template (enqueued)", {
    templateId: id,
    title: data.title,
    domainId: data.domainId,
  });

  return template;
}

/**
 * Update an exercise template
 */
export async function updateExerciseTemplate(
  id: ExerciseTemplateId,
  updates: Partial<Omit<ExerciseTemplate, "id" | "createdAt">>,
  ownerId: string
): Promise<void> {
  const now = new Date().toISOString();

  const payload = {
    id,
    owner_id: ownerId,
    ...snakeCaseUpdates(updates),
    updated_at: now,
  };

  await buffer.enqueue({
    table: "dojo_exercise_templates",
    op: "update",
    payload,
  });

  logger.info("db.local", "Updated exercise template (enqueued)", {
    templateId: id,
  });
}

/**
 * Delete an exercise template
 */
export async function deleteExerciseTemplate(
  id: ExerciseTemplateId,
  ownerId: string
): Promise<void> {
  await buffer.enqueue({
    table: "dojo_exercise_templates",
    op: "delete",
    payload: { id, owner_id: ownerId },
  });

  logger.info("db.local", "Deleted exercise template (enqueued)", {
    templateId: id,
  });
}

// =============================================================================
// Write Operations - Variants
// =============================================================================

/**
 * Create a new exercise variant
 */
export async function createExerciseVariant(
  data: ExerciseVariantCreate,
  ownerId: string
): Promise<ExerciseVariant> {
  const now = new Date().toISOString();
  const id = asExerciseVariantId(crypto.randomUUID());

  const variant: ExerciseVariant = {
    ...data,
    id,
    generatedAt: now,
  };

  const row = exerciseVariantToRow(variant, ownerId);

  await buffer.enqueue({
    table: "dojo_exercise_variants",
    op: "insert",
    payload: row,
  });

  logger.info("db.local", "Created exercise variant (enqueued)", {
    variantId: id,
    templateId: data.templateId,
  });

  return variant;
}

/**
 * Delete an exercise variant
 */
export async function deleteExerciseVariant(
  id: ExerciseVariantId,
  ownerId: string
): Promise<void> {
  await buffer.enqueue({
    table: "dojo_exercise_variants",
    op: "delete",
    payload: { id, owner_id: ownerId },
  });

  logger.info("db.local", "Deleted exercise variant (enqueued)", {
    variantId: id,
  });
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert camelCase update keys to snake_case for DB
 */
function snakeCaseUpdates(updates: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(updates)) {
    const snakeKey = key.replace(
      /[A-Z]/g,
      (letter) => `_${letter.toLowerCase()}`
    );
    result[snakeKey] = value;
  }

  return result;
}
