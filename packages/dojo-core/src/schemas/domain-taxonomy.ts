/**
 * Zod schemas for Domain Taxonomy types
 *
 * Validation schemas for:
 * - DisciplineId
 * - DomainPath
 * - ConceptKind
 * - ExerciseKind
 * - ConceptRelationKind
 * - Hierarchical Domain IDs
 */

import { z } from "zod";

// =============================================================================
// Discipline ID
// =============================================================================

/**
 * Valid discipline identifiers
 */
export const DisciplineIdSchema = z.enum([
  "math",
  "physics",
  "cs",
  "engineering",
  "other",
]);

// =============================================================================
// Hierarchical Domain ID
// =============================================================================

/**
 * Domain ID regex pattern
 * Format: <word>.<word>[.<word>]*
 * Each segment is lowercase alphanumeric with hyphens allowed
 */
const DOMAIN_ID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

/**
 * Schema for hierarchical domain IDs
 * Format: "<discipline>.<area>[.<subarea>]"
 *
 * @example "math.algebra.linear-algebra"
 * @example "physics.quantum-mechanics"
 */
export const HierarchicalDomainIdSchema = z
  .string()
  .min(3)
  .regex(DOMAIN_ID_PATTERN, {
    message:
      "Domain ID must be in format: discipline.area[.subarea] with lowercase letters, numbers, and hyphens",
  });

/**
 * Schema for domain ID with known discipline validation
 */
export const ValidatedDomainIdSchema = HierarchicalDomainIdSchema.refine(
  (val) => {
    const discipline = val.split(".")[0];
    return ["math", "physics", "cs", "engineering", "other"].includes(
      discipline ?? ""
    );
  },
  {
    message:
      "Domain ID must start with a known discipline: math, physics, cs, engineering, or other",
  }
);

// =============================================================================
// Domain Path (Structured)
// =============================================================================

/**
 * Schema for structured domain path
 */
export const DomainPathSchema = z.object({
  /** Top-level discipline */
  discipline: DisciplineIdSchema,

  /** Area within discipline */
  area: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, {
      message: "Area must be lowercase with letters, numbers, and hyphens",
    }),

  /** Optional subarea within area */
  subarea: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/, {
      message: "Subarea must be lowercase with letters, numbers, and hyphens",
    })
    .optional(),
});

// =============================================================================
// Concept Kind
// =============================================================================

/**
 * Schema for semantic concept kinds
 */
export const ConceptKindSchema = z.enum([
  "object",
  "definition",
  "property",
  "theorem",
  "lemma",
  "corollary",
  "axiom",
  "technique",
  "heuristic",
  "example",
]);

// =============================================================================
// Exercise Kind
// =============================================================================

/**
 * Schema for exercise kinds
 */
export const ExerciseKindSchema = z.enum([
  "calculation",
  "concept-check",
  "proof-construction",
  "fill-in-proof",
  "multiple-choice",
  "true-false",
  "error-analysis",
  "derivation",
  "application",
]);

// =============================================================================
// Concept Relation Kind
// =============================================================================

/**
 * Schema for concept relationship types
 */
export const ConceptRelationKindSchema = z.enum([
  "prerequisite",
  "generalization",
  "special-case",
  "analogue",
  "dual",
  "equivalent",
]);

// =============================================================================
// Known Areas (for stricter validation)
// =============================================================================

/**
 * Known mathematics areas (11 Level-1 Domains)
 * Based on MATH_PHYSICS_LIST.md comprehensive taxonomy
 */
export const MathAreaSchema = z.enum([
  "foundations", // Foundations & Logic
  "algebra", // Algebra
  "analysis", // Analysis
  "discrete", // Discrete Mathematics
  "geometry", // Geometry
  "topology", // Topology
  "number-theory", // Number Theory
  "probability-statistics", // Probability & Statistics
  "applied", // Applied Mathematics & Modelling
  "computational", // Computational Mathematics & Numerical Analysis
  "math-physics", // Mathematical Physics & Systems Science
]);

/**
 * Known physics areas (13 Level-1 Domains)
 * Based on MATH_PHYSICS_LIST.md comprehensive taxonomy
 */
export const PhysicsAreaSchema = z.enum([
  "mechanics", // Classical & Continuum Mechanics
  "thermo-stat", // Thermodynamics & Statistical Physics
  "em-optics", // Electromagnetism, Optics & Photonics
  "relativity", // Relativity & Gravitation
  "quantum", // Quantum Physics (Core Theory)
  "amo", // Atomic, Molecular & Optical Physics
  "condensed", // Condensed Matter & Materials Physics
  "nuclear-particle", // Nuclear & Particle Physics
  "plasma", // Plasma & High-Energy Density Physics
  "astro-cosmo", // Astrophysics & Cosmology
  "earth-env", // Earth & Environmental Physics
  "bio-med", // Biophysics & Medical Physics
  "methods", // Computational & Experimental Methods
]);

/**
 * Known computer science areas
 */
export const CsAreaSchema = z.enum([
  "algorithms",
  "data-structures",
  "theory",
  "systems",
  "networks",
  "databases",
  "ai-ml",
  "graphics",
  "security",
  "programming-languages",
]);

// =============================================================================
// Helper Types from Schemas
// =============================================================================

export type DisciplineIdFromSchema = z.infer<typeof DisciplineIdSchema>;
export type DomainPathFromSchema = z.infer<typeof DomainPathSchema>;
export type ConceptKindFromSchema = z.infer<typeof ConceptKindSchema>;
export type ExerciseKindFromSchema = z.infer<typeof ExerciseKindSchema>;
export type ConceptRelationKindFromSchema = z.infer<
  typeof ConceptRelationKindSchema
>;
