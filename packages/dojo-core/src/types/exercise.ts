/**
 * Exercise types: templates, subtasks, and variants
 * Exercises are the core learning objects in the Dojo
 */

import type {
  ExerciseTemplateId,
  ExerciseVariantId,
  SubtaskId,
  ConceptNodeId,
} from "./ids";
import type {
  DomainId,
  DifficultyLevel,
  ImportanceLevel,
  ExerciseTag,
  ExerciseKind,
} from "./enums";

// =============================================================================
// Exercise Subtask
// =============================================================================

/**
 * A subtask within an exercise
 * Exercises are broken into subtasks (a), (b), (c), etc.
 */
export interface ExerciseSubtask {
  /** Unique identifier for this subtask within the exercise */
  id: SubtaskId;

  /** Display label (e.g., "(a)", "(i)", "Part 1") */
  label?: string;

  /** The subtask prompt/question (Markdown/LaTeX) */
  prompt: string;

  /** Ordered hint steps (progressive disclosure) */
  hintSteps?: string[];

  /** Short solution sketch/outline */
  solutionSketch?: string;

  /** Full worked solution (Markdown/LaTeX) */
  fullSolution?: string;

  /** Expected difficulty relative to other subtasks (optional) */
  relativeDifficulty?: number; // 1-5 scale

  /** Approximate expected time in minutes */
  expectedMinutes?: number;
}

/**
 * Input for creating a subtask (without generated fields)
 */
export type ExerciseSubtaskCreate = Omit<ExerciseSubtask, "id">;

// =============================================================================
// Exercise Template
// =============================================================================

/**
 * An exercise template: a reusable problem definition
 * Templates can spawn multiple variants with different parameters
 */
export interface ExerciseTemplate {
  /** Unique identifier */
  id: ExerciseTemplateId;

  /**
   * Hierarchical domain this exercise belongs to
   *
   * Format: "<discipline>.<area>[.<subarea>]"
   * Example: "math.algebra.linear-algebra"
   */
  domainId: DomainId;

  /** Display title (e.g., "Diagonalization of 2×2 Symmetric Matrix") */
  title: string;

  /** Optional description or context (Markdown/LaTeX) */
  description?: string;

  /** Problem statement before subtasks (Markdown/LaTeX) */
  problemStatement?: string;

  /** Ordered list of subtasks */
  subtasks: ExerciseSubtask[];

  // ===== Concept Links =====

  /** Primary concept IDs this exercise targets */
  primaryConceptIds: ConceptNodeId[];

  /** Supporting concept IDs (also tested but not the focus) */
  supportingConceptIds?: ConceptNodeId[];

  // ===== Classification =====

  /**
   * Kind of exercise - determines UI behavior and grading approach
   *
   * Examples: "calculation", "proof-construction", "concept-check"
   */
  exerciseKind: ExerciseKind;

  /** Difficulty level */
  difficulty: DifficultyLevel;

  /** Importance level */
  importance: ImportanceLevel;

  /** Exercise type tags (additional categorization beyond kind) */
  tags: ExerciseTag[];

  // ===== Variants =====

  /** Whether this exercise supports parameterized variants */
  isParameterized: boolean;

  /** JSON schema for variant parameters (if parameterized) */
  parameterSchema?: Record<string, unknown>;

  /** Notes on how to generate variants */
  variantGenerationNote?: string;

  /** IDs of pre-generated variants */
  variantIds?: ExerciseVariantId[];

  // ===== DeepRecall Integration =====

  /** Related annotation IDs from the PDF reader */
  relatedAnnotationIds?: string[];

  /** Related document IDs */
  relatedDocumentIds?: string[];

  /** Related whiteboard/board IDs */
  relatedBoardIds?: string[];

  // ===== Metadata =====

  /** Source of this exercise (textbook, lecture, custom, etc.) */
  source?: string;

  /** Additional author notes (not shown to learner) */
  authorNotes?: string;

  // ===== Global Content Flag =====

  /** Whether this is global content (visible to all users) vs user-owned */
  isGlobal?: boolean;

  /** When this exercise was created */
  createdAt: string;

  /** When this exercise was last updated */
  updatedAt: string;
}

/**
 * Input for creating an exercise template (without generated fields)
 */
export type ExerciseTemplateCreate = Omit<
  ExerciseTemplate,
  "id" | "createdAt" | "updatedAt"
>;

/**
 * Input for updating an exercise template
 */
export type ExerciseTemplateUpdate = Partial<
  Omit<ExerciseTemplate, "id" | "createdAt" | "updatedAt">
> & {
  id: ExerciseTemplateId;
};

// =============================================================================
// Exercise Variant
// =============================================================================

/**
 * A specific instantiation of an exercise template
 * Contains concrete parameter values and optionally modified content
 */
export interface ExerciseVariant {
  /** Unique identifier */
  id: ExerciseVariantId;

  /** Parent template ID */
  templateId: ExerciseTemplateId;

  /** Concrete parameter values */
  parameterValues?: Record<string, unknown>;

  /** Optional: modified problem statement for this variant */
  problemStatementOverride?: string;

  /** Optional: modified subtasks for this variant */
  subtasksOverride?: ExerciseSubtask[];

  /** When this variant was generated */
  generatedAt: string;

  /** Seed used for random generation (if applicable) */
  seed?: number;
}

/**
 * Input for creating a variant
 */
export type ExerciseVariantCreate = Omit<ExerciseVariant, "id" | "generatedAt">;

// =============================================================================
// Exercise Resolution (Template + Variant combined)
// =============================================================================

/**
 * A fully resolved exercise ready for presentation
 * Combines template with variant-specific overrides
 */
export interface ResolvedExercise {
  /** The template being used */
  template: ExerciseTemplate;

  /** The specific variant (null if using base template) */
  variant: ExerciseVariant | null;

  /** Resolved problem statement */
  problemStatement: string;

  /** Resolved subtasks */
  subtasks: ExerciseSubtask[];
}

// =============================================================================
// Exercise Filters
// =============================================================================

/**
 * Filter options for querying exercises
 */
export interface ExerciseFilter {
  domainId?: DomainId;
  conceptIds?: ConceptNodeId[];
  difficulty?: DifficultyLevel;
  importance?: ImportanceLevel;
  tags?: ExerciseTag[];
  isParameterized?: boolean;
  searchQuery?: string;
}
