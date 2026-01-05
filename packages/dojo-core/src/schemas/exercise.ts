/**
 * Zod schemas for Exercise types
 */

import { z } from "zod";
import {
  DomainIdSchema,
  DifficultyLevelSchema,
  ImportanceLevelSchema,
  ExerciseTagSchema,
} from "./enums";
import { ExerciseKindSchema } from "./domain-taxonomy";

// =============================================================================
// ExerciseSubtask Schema
// =============================================================================

export const ExerciseSubtaskSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  prompt: z.string().min(1),
  hintSteps: z.array(z.string()).optional(),
  solutionSketch: z.string().optional(),
  fullSolution: z.string().optional(),
  relativeDifficulty: z.number().min(1).max(5).optional(),
  expectedMinutes: z.number().positive().optional(),
});

export type ExerciseSubtaskSchemaType = z.infer<typeof ExerciseSubtaskSchema>;

export const ExerciseSubtaskCreateSchema = ExerciseSubtaskSchema.omit({
  id: true,
});

export type ExerciseSubtaskCreateSchemaType = z.infer<
  typeof ExerciseSubtaskCreateSchema
>;

// =============================================================================
// ExerciseTemplate Schema
// =============================================================================

export const ExerciseTemplateSchema = z.object({
  id: z.string().min(1),
  domainId: DomainIdSchema,
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  problemStatement: z.string().optional(),
  subtasks: z.array(ExerciseSubtaskSchema).min(1),

  // Concept links
  primaryConceptIds: z.array(z.string()).min(1),
  supportingConceptIds: z.array(z.string()).optional(),

  // Classification
  exerciseKind: ExerciseKindSchema,
  difficulty: DifficultyLevelSchema,
  importance: ImportanceLevelSchema,
  tags: z.array(ExerciseTagSchema),

  // Global content flag
  isGlobal: z.boolean().optional(),

  // Variants
  isParameterized: z.boolean(),
  parameterSchema: z.record(z.string(), z.unknown()).optional(),
  variantGenerationNote: z.string().optional(),
  variantIds: z.array(z.string()).optional(),

  // DeepRecall integration
  relatedAnnotationIds: z.array(z.string()).optional(),
  relatedDocumentIds: z.array(z.string()).optional(),
  relatedBoardIds: z.array(z.string()).optional(),

  // Metadata
  source: z.string().optional(),
  authorNotes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ExerciseTemplateSchemaType = z.infer<typeof ExerciseTemplateSchema>;

// =============================================================================
// ExerciseTemplate Create Schema
// =============================================================================

export const ExerciseTemplateCreateSchema = ExerciseTemplateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Allow creating subtasks without IDs (they'll be generated)
  subtasks: z.array(ExerciseSubtaskCreateSchema).min(1),
});

export type ExerciseTemplateCreateSchemaType = z.infer<
  typeof ExerciseTemplateCreateSchema
>;

// =============================================================================
// ExerciseTemplate Update Schema
// =============================================================================

export const ExerciseTemplateUpdateSchema = ExerciseTemplateSchema.partial()
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    id: z.string().min(1),
  });

export type ExerciseTemplateUpdateSchemaType = z.infer<
  typeof ExerciseTemplateUpdateSchema
>;

// =============================================================================
// ExerciseVariant Schema
// =============================================================================

export const ExerciseVariantSchema = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  parameterValues: z.record(z.string(), z.unknown()).optional(),
  problemStatementOverride: z.string().optional(),
  subtasksOverride: z.array(ExerciseSubtaskSchema).optional(),
  generatedAt: z.string().datetime(),
  seed: z.number().int().optional(),
});

export type ExerciseVariantSchemaType = z.infer<typeof ExerciseVariantSchema>;

export const ExerciseVariantCreateSchema = ExerciseVariantSchema.omit({
  id: true,
  generatedAt: true,
});

export type ExerciseVariantCreateSchemaType = z.infer<
  typeof ExerciseVariantCreateSchema
>;

// =============================================================================
// ResolvedExercise Schema
// =============================================================================

export const ResolvedExerciseSchema = z.object({
  template: ExerciseTemplateSchema,
  variant: ExerciseVariantSchema.nullable(),
  problemStatement: z.string(),
  subtasks: z.array(ExerciseSubtaskSchema),
});

export type ResolvedExerciseSchemaType = z.infer<typeof ResolvedExerciseSchema>;

// =============================================================================
// ExerciseFilter Schema
// =============================================================================

export const ExerciseFilterSchema = z.object({
  domainId: DomainIdSchema.optional(),
  conceptIds: z.array(z.string()).optional(),
  difficulty: DifficultyLevelSchema.optional(),
  importance: ImportanceLevelSchema.optional(),
  tags: z.array(ExerciseTagSchema).optional(),
  isParameterized: z.boolean().optional(),
  searchQuery: z.string().optional(),
});

export type ExerciseFilterSchemaType = z.infer<typeof ExerciseFilterSchema>;
