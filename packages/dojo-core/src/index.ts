/**
 * @deeprecall/dojo-core
 * Domain layer for DeepRecall Dojo - math/physics problem solving and spaced repetition
 *
 * This package contains:
 * - Types: All domain entity types and enums
 * - Schemas: Zod validation schemas for all types
 * - Logic: Pure functions for mastery computation, scheduling, and graph operations
 * - Repositories: Abstract interfaces for data access
 * - Utils: ID generation, date utilities, and helper functions
 */

// =============================================================================
// Types
// =============================================================================

// Branded ID types
export type {
  ConceptNodeId,
  ExerciseTemplateId,
  ExerciseVariantId,
  SubtaskId,
  UserId,
  AttemptId,
  SessionId,
  SchedulerItemId,
  ConceptBrickStateId,
  ExerciseBrickStateId,
} from "./types/ids";

export {
  isValidId,
  asConceptNodeId,
  asExerciseTemplateId,
  asExerciseVariantId,
  asSubtaskId,
  asUserId,
  asAttemptId,
  asSessionId,
  asSchedulerItemId,
  asConceptBrickStateId,
  asExerciseBrickStateId,
} from "./types/ids";

// Enums and literal types
export type {
  DomainId,
  DifficultyLevel,
  ImportanceLevel,
  ExerciseTag,
  AttemptMode,
  AttemptType,
  SubtaskResult,
  ErrorType,
  SchedulerReason,
} from "./types/enums";

export {
  DOMAIN_LABELS,
  DIFFICULTY_LEVELS,
  DIFFICULTY_LABELS,
  IMPORTANCE_LEVELS,
  IMPORTANCE_LABELS,
  EXERCISE_TAGS,
  EXERCISE_TAG_LABELS,
  ATTEMPT_MODES,
  ATTEMPT_MODE_LABELS,
  ATTEMPT_TYPES,
  SUBTASK_RESULTS,
  SUBTASK_RESULT_LABELS,
  ERROR_TYPES,
  ERROR_TYPE_LABELS,
  SCHEDULER_REASONS,
} from "./types/enums";

// Domain taxonomy types (hierarchical classification)
export type {
  DisciplineId,
  DomainPath,
  MathArea,
  PhysicsArea,
  CsArea,
  ConceptKind,
  ExerciseKind,
  ExerciseKindBehavior,
  ConceptRelationKind,
  // Math subarea types
  FoundationsSubarea,
  AlgebraSubarea,
  AnalysisSubarea,
  DiscreteSubarea,
  GeometrySubarea,
  TopologySubarea,
  NumberTheorySubarea,
  ProbabilityStatisticsSubarea,
  AppliedSubarea,
  ComputationalSubarea,
  MathPhysicsSubarea,
  // Physics subarea types
  MechanicsSubarea,
  ThermoStatSubarea,
  EmOpticsSubarea,
  RelativitySubarea,
  QuantumSubarea,
  AmoSubarea,
  CondensedSubarea,
  NuclearParticleSubarea,
  PlasmaSubarea,
  AstroCosmoSubarea,
  EarthEnvSubarea,
  BioMedSubarea,
  MethodsSubarea,
} from "./types/domain-taxonomy";

export {
  DISCIPLINE_IDS,
  DISCIPLINE_LABELS,
  MATH_AREAS,
  MATH_AREA_LABELS,
  PHYSICS_AREAS,
  PHYSICS_AREA_LABELS,
  CS_AREAS,
  CS_AREA_LABELS,
  // Math subareas
  FOUNDATIONS_SUBAREAS,
  FOUNDATIONS_SUBAREA_LABELS,
  ALGEBRA_SUBAREAS,
  ALGEBRA_SUBAREA_LABELS,
  ANALYSIS_SUBAREAS,
  ANALYSIS_SUBAREA_LABELS,
  DISCRETE_SUBAREAS,
  DISCRETE_SUBAREA_LABELS,
  GEOMETRY_SUBAREAS,
  GEOMETRY_SUBAREA_LABELS,
  TOPOLOGY_SUBAREAS,
  TOPOLOGY_SUBAREA_LABELS,
  NUMBER_THEORY_SUBAREAS,
  NUMBER_THEORY_SUBAREA_LABELS,
  PROBABILITY_STATISTICS_SUBAREAS,
  PROBABILITY_STATISTICS_SUBAREA_LABELS,
  APPLIED_SUBAREAS,
  APPLIED_SUBAREA_LABELS,
  COMPUTATIONAL_SUBAREAS,
  COMPUTATIONAL_SUBAREA_LABELS,
  MATH_PHYSICS_SUBAREAS,
  MATH_PHYSICS_SUBAREA_LABELS,
  // Physics subareas
  MECHANICS_SUBAREAS,
  MECHANICS_SUBAREA_LABELS,
  THERMO_STAT_SUBAREAS,
  THERMO_STAT_SUBAREA_LABELS,
  EM_OPTICS_SUBAREAS,
  EM_OPTICS_SUBAREA_LABELS,
  RELATIVITY_SUBAREAS,
  RELATIVITY_SUBAREA_LABELS,
  QUANTUM_SUBAREAS,
  QUANTUM_SUBAREA_LABELS,
  AMO_SUBAREAS,
  AMO_SUBAREA_LABELS,
  CONDENSED_SUBAREAS,
  CONDENSED_SUBAREA_LABELS,
  NUCLEAR_PARTICLE_SUBAREAS,
  NUCLEAR_PARTICLE_SUBAREA_LABELS,
  PLASMA_SUBAREAS,
  PLASMA_SUBAREA_LABELS,
  ASTRO_COSMO_SUBAREAS,
  ASTRO_COSMO_SUBAREA_LABELS,
  EARTH_ENV_SUBAREAS,
  EARTH_ENV_SUBAREA_LABELS,
  BIO_MED_SUBAREAS,
  BIO_MED_SUBAREA_LABELS,
  METHODS_SUBAREAS,
  METHODS_SUBAREA_LABELS,
  // Aggregate lookups
  MATH_SUBAREAS_BY_AREA,
  PHYSICS_SUBAREAS_BY_AREA,
  MATH_SUBAREA_LABELS_BY_AREA,
  PHYSICS_SUBAREA_LABELS_BY_AREA,
  // Concept & exercise kinds
  CONCEPT_KINDS,
  CONCEPT_KIND_LABELS,
  CONCEPT_KIND_ICONS,
  EXERCISE_KINDS,
  EXERCISE_KIND_LABELS,
  EXERCISE_KIND_BEHAVIORS,
  CONCEPT_RELATION_KINDS,
  CONCEPT_RELATION_KIND_LABELS,
} from "./types/domain-taxonomy";

// Common domain ID examples and legacy mapping
export { COMMON_DOMAIN_IDS, LEGACY_DOMAIN_MAPPING } from "./types/enums";

// Concept types
export type {
  ConceptNode,
  ConceptNodeCreate,
  ConceptNodeUpdate,
  ConceptEdge,
  ConceptGraph,
  ConceptNodeWithLevel,
  ConceptFilter,
} from "./types/concept";

// Exercise types
export type {
  ExerciseSubtask,
  ExerciseSubtaskCreate,
  ExerciseTemplate,
  ExerciseTemplateCreate,
  ExerciseTemplateUpdate,
  ExerciseVariant,
  ExerciseVariantCreate,
  ResolvedExercise,
  ExerciseFilter,
} from "./types/exercise";

// Attempt types
export type {
  SubtaskAttempt,
  ExerciseAttempt,
  ExerciseAttemptCreate,
  ExerciseAttemptComplete,
  AttemptSummary,
  AttemptAnalytics,
} from "./types/attempt";

// Session types
export type {
  Session,
  SessionStart,
  SessionComplete,
  SessionSummary,
  PracticeStreak,
  SessionPlan,
} from "./types/session";

// Brick/Mastery types
export type {
  BrickMastery,
  ConceptBrickState,
  ExerciseBrickState,
  BrickDisplayState,
  UserProgressSummary,
} from "./types/brick";

export {
  EMPTY_BRICK_MASTERY,
  getMasteryLevel,
  getMasteryColor,
} from "./types/brick";

// Scheduler types
export type {
  SchedulerItem,
  SchedulerItemCreate,
  SchedulerQueue,
  SchedulerConfig,
  SchedulingProposal,
  LearningPath,
  DailyAgenda,
} from "./types/scheduler";

export { DEFAULT_SCHEDULER_CONFIG } from "./types/scheduler";

// =============================================================================
// Schemas
// =============================================================================

export * from "./schemas";

// =============================================================================
// Logic
// =============================================================================

// Mastery computation
export {
  computeAttemptAccuracy,
  computeWeightedAccuracy,
  computeMedian,
  computeTimeStats,
  computeStabilityScore,
  detectTrend,
  computeCorrectStreak,
  computeMasteryScore,
  updateBrickMastery,
  incrementBrickMastery,
} from "./logic/mastery";

// Scheduling
export {
  computeNextInterval,
  computeScheduledDate,
  computePriority,
  proposeNextReviews,
  proposeInitialSchedule,
  sortByPriority,
  filterDue,
  filterDueToday,
  filterDueThisWeek,
  countOverdue,
  interleaveByConceptId,
} from "./logic/scheduling";

// Graph operations
export {
  buildPrerequisiteMap,
  buildDependentMap,
  wouldCreateCycle,
  detectCycles,
  computeLevels,
  topologicalSort,
  enrichNodesWithLevels,
  getAncestors,
  getDescendants,
  extractNeighborhood,
  validateGraph,
} from "./logic/graph";

// =============================================================================
// Repositories
// =============================================================================

export type {
  ConceptRepository,
  ConceptBrickRepository,
} from "./repositories/concept.repository";

export type {
  ExerciseTemplateRepository,
  ExerciseVariantRepository,
  ExerciseResolver,
  ExerciseBrickRepository,
} from "./repositories/exercise.repository";

export type {
  AttemptRepository,
  AttemptEventEmitter,
} from "./repositories/attempt.repository";

export type {
  SessionRepository,
  SessionPlannerRepository,
} from "./repositories/session.repository";

export type {
  SchedulerItemRepository,
  SchedulerConfigRepository,
  DailyAgendaRepository,
  LearningPathRepository,
} from "./repositories/scheduler.repository";

// =============================================================================
// Utils
// =============================================================================

// ID generation
export {
  generateConceptNodeId,
  generateExerciseTemplateId,
  generateExerciseVariantId,
  generateSubtaskId,
  generateUserId,
  generateAttemptId,
  generateSessionId,
  generateSchedulerItemId,
  generateConceptBrickStateId,
  generateExerciseBrickStateId,
  generateConceptBrickId,
  generateExerciseBrickId,
  generateSlug,
  generateUniqueSlug,
} from "./utils/ids";

// Date utilities
export {
  nowISO,
  todayISO,
  parseDate,
  formatDate,
  formatDateTime,
  formatDuration,
  formatMinutes,
  startOfToday,
  endOfToday,
  startOfWeek,
  endOfWeek,
  addDays,
  diffDays,
  isToday,
  isPast,
  isSameDay,
  calculateStreak,
} from "./utils/dates";

// Helper functions
export {
  isDefined,
  isNonEmpty,
  isNonEmptyString,
  assert,
  assertDefined,
  pick,
  omit,
  deepClone,
  groupBy,
  keyBy,
  unique,
  uniqueBy,
  normalizeSubtasks,
  normalizeAttempt,
  withTimestamps,
  withUpdatedAt,
} from "./utils/helpers";

// Domain path utilities
export {
  parseDomainId,
  makeDomainId,
  getDiscipline,
  getArea,
  getSubarea,
  isValidDomainId,
  hasKnownDiscipline,
  getParentDomain,
  isDomainAncestor,
  sameDiscipline,
  sameArea,
  getDomainLabel,
  getShortDomainLabel,
} from "./utils/domain-path";
