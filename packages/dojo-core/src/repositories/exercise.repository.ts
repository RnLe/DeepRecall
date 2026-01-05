/**
 * Repository interfaces for Exercise-related data access
 */

import type {
  ExerciseTemplate,
  ExerciseTemplateCreate,
  ExerciseTemplateUpdate,
  ExerciseVariant,
  ExerciseVariantCreate,
  ResolvedExercise,
  ExerciseFilter,
} from "../types/exercise";
import type {
  ExerciseTemplateId,
  ExerciseVariantId,
  ConceptNodeId,
  UserId,
} from "../types/ids";
import type { DomainId } from "../types/enums";
import type { ExerciseBrickState, BrickMastery } from "../types/brick";

// =============================================================================
// ExerciseTemplateRepository Interface
// =============================================================================

/**
 * Repository for ExerciseTemplate CRUD operations
 */
export interface ExerciseTemplateRepository {
  // ===== Read Operations =====

  /**
   * Get an exercise template by ID
   */
  getById(id: ExerciseTemplateId): Promise<ExerciseTemplate | null>;

  /**
   * Get multiple templates by IDs
   */
  getByIds(ids: ExerciseTemplateId[]): Promise<ExerciseTemplate[]>;

  /**
   * List all templates in a domain
   */
  listByDomain(domainId: DomainId): Promise<ExerciseTemplate[]>;

  /**
   * List templates targeting specific concepts
   */
  listByConcepts(conceptIds: ConceptNodeId[]): Promise<ExerciseTemplate[]>;

  /**
   * List templates matching a filter
   */
  list(filter?: ExerciseFilter): Promise<ExerciseTemplate[]>;

  /**
   * List all templates
   */
  listAll(): Promise<ExerciseTemplate[]>;

  /**
   * Search templates by title/description
   */
  search(query: string, limit?: number): Promise<ExerciseTemplate[]>;

  // ===== Write Operations =====

  /**
   * Create a new template
   */
  create(data: ExerciseTemplateCreate): Promise<ExerciseTemplate>;

  /**
   * Update an existing template
   */
  update(data: ExerciseTemplateUpdate): Promise<ExerciseTemplate>;

  /**
   * Delete a template by ID
   */
  delete(id: ExerciseTemplateId): Promise<void>;

  // ===== Relationship Queries =====

  /**
   * Get templates linked to a specific concept
   */
  getByPrimaryConcept(conceptId: ConceptNodeId): Promise<ExerciseTemplate[]>;

  /**
   * Get templates where a concept is supporting
   */
  getBySupportingConcept(conceptId: ConceptNodeId): Promise<ExerciseTemplate[]>;

  /**
   * Count templates per concept
   */
  countByConceptId(): Promise<Map<string, number>>;
}

// =============================================================================
// ExerciseVariantRepository Interface
// =============================================================================

/**
 * Repository for ExerciseVariant CRUD operations
 */
export interface ExerciseVariantRepository {
  /**
   * Get a variant by ID
   */
  getById(id: ExerciseVariantId): Promise<ExerciseVariant | null>;

  /**
   * Get all variants for a template
   */
  listByTemplate(templateId: ExerciseTemplateId): Promise<ExerciseVariant[]>;

  /**
   * Create a new variant
   */
  create(data: ExerciseVariantCreate): Promise<ExerciseVariant>;

  /**
   * Delete a variant
   */
  delete(id: ExerciseVariantId): Promise<void>;

  /**
   * Delete all variants for a template
   */
  deleteByTemplate(templateId: ExerciseTemplateId): Promise<void>;
}

// =============================================================================
// ExerciseResolver Interface
// =============================================================================

/**
 * Service for resolving exercises (template + variant → displayable exercise)
 */
export interface ExerciseResolver {
  /**
   * Resolve a template to a displayable exercise (no variant)
   */
  resolveTemplate(
    templateId: ExerciseTemplateId
  ): Promise<ResolvedExercise | null>;

  /**
   * Resolve a specific variant
   */
  resolveVariant(
    variantId: ExerciseVariantId
  ): Promise<ResolvedExercise | null>;

  /**
   * Resolve with optional variant (variant overrides template if provided)
   */
  resolve(
    templateId: ExerciseTemplateId,
    variantId?: ExerciseVariantId
  ): Promise<ResolvedExercise | null>;

  /**
   * Generate a new variant for a template
   */
  generateVariant(
    templateId: ExerciseTemplateId,
    seed?: number
  ): Promise<ResolvedExercise | null>;
}

// =============================================================================
// ExerciseBrickRepository Interface
// =============================================================================

/**
 * Repository for exercise brick states (user-specific mastery data)
 */
export interface ExerciseBrickRepository {
  /**
   * Get brick state for a user/exercise pair
   */
  get(
    userId: UserId,
    templateId: ExerciseTemplateId
  ): Promise<ExerciseBrickState | null>;

  /**
   * Get all brick states for a user
   */
  listByUser(userId: UserId): Promise<ExerciseBrickState[]>;

  /**
   * Get brick states for specific exercises
   */
  listByUserAndExercises(
    userId: UserId,
    templateIds: ExerciseTemplateId[]
  ): Promise<ExerciseBrickState[]>;

  /**
   * Get brick states for exercises in a domain
   */
  listByUserAndDomain(
    userId: UserId,
    domainId: DomainId
  ): Promise<ExerciseBrickState[]>;

  /**
   * Create or update a brick state
   */
  upsert(
    userId: UserId,
    templateId: ExerciseTemplateId,
    metrics: BrickMastery,
    recentAttemptIds?: string[]
  ): Promise<ExerciseBrickState>;

  /**
   * Delete a brick state
   */
  delete(userId: UserId, templateId: ExerciseTemplateId): Promise<void>;

  /**
   * Get exercises due for review
   */
  listDue(userId: UserId, before?: Date): Promise<ExerciseBrickState[]>;

  /**
   * Get exercises that need practice (low mastery)
   */
  listNeedsPractice(
    userId: UserId,
    threshold?: number
  ): Promise<ExerciseBrickState[]>;
}
