/**
 * Zod schemas for ConceptNode and related types
 */

import { z } from "zod";
import {
  DomainIdSchema,
  DifficultyLevelSchema,
  ImportanceLevelSchema,
} from "./enums";
import { ConceptKindSchema } from "./domain-taxonomy";

// =============================================================================
// ConceptNode Schema
// =============================================================================

export const ConceptNodeSchema = z.object({
  id: z.string().min(1),
  domainId: DomainIdSchema,
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().optional(),

  // Semantic kind of the concept
  conceptKind: ConceptKindSchema,

  difficulty: DifficultyLevelSchema,
  importance: ImportanceLevelSchema,

  // Graph structure
  prerequisiteIds: z.array(z.string()),
  tagIds: z.array(z.string()).optional(),

  // Global content flag
  isGlobal: z.boolean().optional(),

  // DeepRecall integration
  relatedAnnotationIds: z.array(z.string()).optional(),
  relatedDocumentIds: z.array(z.string()).optional(),
  relatedBoardIds: z.array(z.string()).optional(),

  // Metadata
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ConceptNodeSchemaType = z.infer<typeof ConceptNodeSchema>;

// =============================================================================
// ConceptNode Create Schema
// =============================================================================

export const ConceptNodeCreateSchema = ConceptNodeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ConceptNodeCreateSchemaType = z.infer<
  typeof ConceptNodeCreateSchema
>;

// =============================================================================
// ConceptNode Update Schema
// =============================================================================

export const ConceptNodeUpdateSchema = ConceptNodeSchema.partial()
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    id: z.string().min(1),
  });

export type ConceptNodeUpdateSchemaType = z.infer<
  typeof ConceptNodeUpdateSchema
>;

// =============================================================================
// ConceptEdge Schema
// =============================================================================

export const ConceptEdgeSchema = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  weight: z.number().min(0).max(1).optional(),
});

export type ConceptEdgeSchemaType = z.infer<typeof ConceptEdgeSchema>;

// =============================================================================
// ConceptGraph Schema
// =============================================================================

export const ConceptGraphSchema = z.object({
  nodes: z.array(ConceptNodeSchema),
  edges: z.array(ConceptEdgeSchema),
});

export type ConceptGraphSchemaType = z.infer<typeof ConceptGraphSchema>;

// =============================================================================
// ConceptFilter Schema
// =============================================================================

export const ConceptFilterSchema = z.object({
  domainId: DomainIdSchema.optional(),
  difficulty: DifficultyLevelSchema.optional(),
  importance: ImportanceLevelSchema.optional(),
  tagIds: z.array(z.string()).optional(),
  searchQuery: z.string().optional(),
});

export type ConceptFilterSchemaType = z.infer<typeof ConceptFilterSchema>;
