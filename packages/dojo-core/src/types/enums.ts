/**
 * Core domain enums and literal types
 * These define the vocabulary of the Dojo domain
 */

// Re-export domain taxonomy types for convenience
export type {
  DisciplineId,
  DomainPath,
  ConceptKind,
  ExerciseKind,
  ConceptRelationKind,
} from "./domain-taxonomy";

export {
  DISCIPLINE_IDS,
  DISCIPLINE_LABELS,
  MATH_AREAS,
  MATH_AREA_LABELS,
  PHYSICS_AREAS,
  PHYSICS_AREA_LABELS,
  CS_AREAS,
  CS_AREA_LABELS,
  CONCEPT_KINDS,
  CONCEPT_KIND_LABELS,
  CONCEPT_KIND_ICONS,
  EXERCISE_KINDS,
  EXERCISE_KIND_LABELS,
  EXERCISE_KIND_BEHAVIORS,
  CONCEPT_RELATION_KINDS,
  CONCEPT_RELATION_KIND_LABELS,
} from "./domain-taxonomy";

// =============================================================================
// Domain Identifiers
// =============================================================================

/**
 * Hierarchical domain identifier
 *
 * Format: "<discipline>.<area>[.<subarea>]"
 *
 * Examples:
 *   - "math.algebra.linear-algebra"
 *   - "physics.classical-mechanics.lagrangian"
 *   - "cs.algorithms.graph-algorithms"
 *
 * The hierarchical format allows for:
 *   - Filtering by discipline (all math topics)
 *   - Filtering by area (all analysis topics)
 *   - Precise classification (specific subarea)
 *
 * Legacy flat IDs are still supported but should be migrated.
 */
export type DomainId = string & {};

/**
 * Common domain ID examples for autocomplete
 * These represent the new hierarchical format
 */
export const COMMON_DOMAIN_IDS = [
  // Mathematics
  "math.algebra.linear-algebra",
  "math.algebra.group-theory",
  "math.analysis.real-analysis",
  "math.analysis.complex-analysis",
  "math.analysis.functional-analysis",
  "math.analysis.measure-theory",
  "math.analysis.vector-calculus",
  "math.analysis.ode",
  "math.analysis.pde",
  "math.topology.point-set",
  "math.topology.algebraic",
  "math.statistics.probability",
  "math.statistics.inference",
  "math.logic-and-foundations.set-theory",
  "math.logic-and-foundations.category-theory",

  // Physics
  "physics.classical-mechanics.newtonian",
  "physics.classical-mechanics.lagrangian",
  "physics.classical-mechanics.hamiltonian",
  "physics.electromagnetism.electrostatics",
  "physics.electromagnetism.magnetostatics",
  "physics.electromagnetism.maxwell",
  "physics.thermodynamics.classical",
  "physics.statistical-mechanics.equilibrium",
  "physics.quantum-mechanics.nonrelativistic",
  "physics.quantum-mechanics.qft",
  "physics.relativity.special",
  "physics.relativity.general",
  "physics.condensed-matter.solid-state",

  // Computer Science
  "cs.algorithms.sorting",
  "cs.algorithms.graph-algorithms",
  "cs.algorithms.dynamic-programming",
  "cs.data-structures.trees",
  "cs.data-structures.graphs",
  "cs.theory.complexity",
  "cs.theory.automata",
] as const;

/**
 * Legacy domain ID mapping
 * Maps old flat IDs to new hierarchical format
 */
export const LEGACY_DOMAIN_MAPPING: Record<string, string> = {
  "linear-algebra": "math.algebra.linear-algebra",
  analysis: "math.analysis.real-analysis",
  "complex-analysis": "math.analysis.complex-analysis",
  ode: "math.analysis.ode",
  pde: "math.analysis.pde",
  probability: "math.statistics.probability",
  statistics: "math.statistics.inference",
  mechanics: "physics.classical-mechanics.newtonian",
  electromagnetism: "physics.electromagnetism.maxwell",
  thermodynamics: "physics.thermodynamics.classical",
  "quantum-mechanics": "physics.quantum-mechanics.nonrelativistic",
  "special-relativity": "physics.relativity.special",
  "general-relativity": "physics.relativity.general",
  "solid-state": "physics.condensed-matter.solid-state",
};

/**
 * Human-readable domain names
 * Now dynamically generated from hierarchical IDs
 * @deprecated Use getDomainLabel from utils/domain-path instead
 */
export const DOMAIN_LABELS: Record<string, string> = {
  // Legacy flat format (for backwards compatibility)
  "linear-algebra": "Linear Algebra",
  analysis: "Real Analysis",
  "complex-analysis": "Complex Analysis",
  ode: "Ordinary Differential Equations",
  pde: "Partial Differential Equations",
  probability: "Probability Theory",
  statistics: "Statistics",
  mechanics: "Classical Mechanics",
  electromagnetism: "Electromagnetism",
  thermodynamics: "Thermodynamics",
  "quantum-mechanics": "Quantum Mechanics",
  "special-relativity": "Special Relativity",
  "general-relativity": "General Relativity",
  "solid-state": "Solid State Physics",

  // New hierarchical format (common ones)
  "math.algebra.linear-algebra": "Mathematics › Algebra › Linear Algebra",
  "math.analysis.real-analysis": "Mathematics › Analysis › Real Analysis",
  "math.analysis.complex-analysis": "Mathematics › Analysis › Complex Analysis",
  "physics.classical-mechanics.lagrangian":
    "Physics › Classical Mechanics › Lagrangian",
  "physics.quantum-mechanics.nonrelativistic":
    "Physics › Quantum Mechanics › Nonrelativistic",
};

// =============================================================================
// Difficulty & Importance Levels
// =============================================================================

/**
 * Difficulty level of a concept or exercise
 * Corresponds roughly to course progression
 */
export type DifficultyLevel = "intro" | "core" | "advanced";

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  "intro",
  "core",
  "advanced",
];

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  intro: "Introductory",
  core: "Core",
  advanced: "Advanced",
};

/**
 * Importance level for curriculum planning
 * Helps prioritize what to study first
 */
export type ImportanceLevel = "fundamental" | "supporting" | "enrichment";

export const IMPORTANCE_LEVELS: ImportanceLevel[] = [
  "fundamental",
  "supporting",
  "enrichment",
];

export const IMPORTANCE_LABELS: Record<ImportanceLevel, string> = {
  fundamental: "Fundamental",
  supporting: "Supporting",
  enrichment: "Enrichment",
};

// =============================================================================
// Exercise Tags (for filtering and categorization)
// =============================================================================

/**
 * Exercise type tags for categorization
 * An exercise can have multiple tags
 */
export type ExerciseTag =
  | "calculation" // Computational/algebraic manipulation
  | "conceptual" // Understanding and reasoning
  | "definition" // Working with definitions
  | "proof" // Mathematical proofs
  | "error-analysis" // Finding/analyzing errors
  | "multiple-choice" // Multiple choice format
  | "worked-example" // Step-by-step worked solution
  | "application" // Real-world application
  | "derivation" // Deriving formulas/results
  | "estimation" // Order-of-magnitude estimates
  | "visualization"; // Geometric/visual reasoning

export const EXERCISE_TAGS: ExerciseTag[] = [
  "calculation",
  "conceptual",
  "definition",
  "proof",
  "error-analysis",
  "multiple-choice",
  "worked-example",
  "application",
  "derivation",
  "estimation",
  "visualization",
];

export const EXERCISE_TAG_LABELS: Record<ExerciseTag, string> = {
  calculation: "Calculation",
  conceptual: "Conceptual",
  definition: "Definition",
  proof: "Proof",
  "error-analysis": "Error Analysis",
  "multiple-choice": "Multiple Choice",
  "worked-example": "Worked Example",
  application: "Application",
  derivation: "Derivation",
  estimation: "Estimation",
  visualization: "Visualization",
};

// =============================================================================
// Attempt & Session Modes
// =============================================================================

/**
 * Mode in which an attempt or session is conducted
 */
export type AttemptMode =
  | "normal" // Regular spaced practice
  | "cram" // Intensive focused practice
  | "exam-sim"; // Exam simulation

export const ATTEMPT_MODES: AttemptMode[] = ["normal", "cram", "exam-sim"];

export const ATTEMPT_MODE_LABELS: Record<AttemptMode, string> = {
  normal: "Normal Practice",
  cram: "Cram Session",
  "exam-sim": "Exam Simulation",
};

/**
 * Type of attempt (first try, redo, or variant)
 */
export type AttemptType =
  | "original" // First attempt at this exercise
  | "redo" // Redoing the same variant
  | "variant"; // Attempting a different variant

export const ATTEMPT_TYPES: AttemptType[] = ["original", "redo", "variant"];

// =============================================================================
// Subtask Results
// =============================================================================

/**
 * Result of a single subtask attempt
 */
export type SubtaskResult =
  | "correct" // Fully correct
  | "partially-correct" // Partially correct (conceptually right, minor errors)
  | "incorrect" // Incorrect
  | "skipped"; // Skipped by user

export const SUBTASK_RESULTS: SubtaskResult[] = [
  "correct",
  "partially-correct",
  "incorrect",
  "skipped",
];

export const SUBTASK_RESULT_LABELS: Record<SubtaskResult, string> = {
  correct: "Correct",
  "partially-correct": "Partially Correct",
  incorrect: "Incorrect",
  skipped: "Skipped",
};

// =============================================================================
// Error Types (for metacognition)
// =============================================================================

/**
 * Types of errors for post-attempt analysis
 * Helps identify patterns in mistakes
 */
export type ErrorType =
  | "algebra" // Algebraic manipulation error
  | "arithmetic" // Basic arithmetic error
  | "concept" // Conceptual misunderstanding
  | "careless" // Careless mistake (knew but slipped)
  | "notation" // Notation or convention error
  | "sign" // Sign error
  | "units" // Unit/dimension error
  | "incomplete" // Incomplete solution
  | "wrong-method" // Used wrong approach
  | "setup" // Problem setup error
  | "interpretation"; // Misread or misinterpreted problem

export const ERROR_TYPES: ErrorType[] = [
  "algebra",
  "arithmetic",
  "concept",
  "careless",
  "notation",
  "sign",
  "units",
  "incomplete",
  "wrong-method",
  "setup",
  "interpretation",
];

export const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  algebra: "Algebra Error",
  arithmetic: "Arithmetic Error",
  concept: "Conceptual Error",
  careless: "Careless Mistake",
  notation: "Notation Error",
  sign: "Sign Error",
  units: "Units/Dimensions",
  incomplete: "Incomplete",
  "wrong-method": "Wrong Method",
  setup: "Setup Error",
  interpretation: "Interpretation Error",
};

// =============================================================================
// Scheduler Reasons
// =============================================================================

/**
 * Reason why an item was scheduled
 */
export type SchedulerReason =
  | "initial" // First introduction of the exercise
  | "review" // Regular spaced review
  | "cram-followup" // Follow-up after cram session
  | "error-recovery" // Scheduled due to errors
  | "user-request"; // User manually requested review

export const SCHEDULER_REASONS: SchedulerReason[] = [
  "initial",
  "review",
  "cram-followup",
  "error-recovery",
  "user-request",
];
