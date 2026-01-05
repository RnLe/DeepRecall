/**
 * Domain Path Utilities
 *
 * Functions for parsing and constructing hierarchical domain IDs.
 *
 * Domain ID format: "<discipline>.<area>[.<subarea>]"
 *
 * Examples:
 *   - "math.algebra.linear-algebra" → { discipline: "math", area: "algebra", subarea: "linear-algebra" }
 *   - "physics.classical-mechanics" → { discipline: "physics", area: "classical-mechanics" }
 */

import type { DomainPath, DisciplineId } from "../types/domain-taxonomy";
import { DISCIPLINE_IDS } from "../types/domain-taxonomy";

// =============================================================================
// Parsing
// =============================================================================

/**
 * Parse a domain ID string into a structured DomainPath.
 *
 * @param domainId - Domain ID in format "<discipline>.<area>[.<subarea>]"
 * @returns Parsed DomainPath with discipline, area, and optional subarea
 *
 * @example
 * parseDomainId("math.algebra.linear-algebra")
 * // => { discipline: "math", area: "algebra", subarea: "linear-algebra" }
 *
 * @example
 * parseDomainId("physics.quantum-mechanics")
 * // => { discipline: "physics", area: "quantum-mechanics", subarea: undefined }
 */
export function parseDomainId(domainId: string): DomainPath {
  const parts = domainId.split(".");

  // Handle edge cases
  if (parts.length === 0 || !parts[0]) {
    return {
      discipline: "other",
      area: "misc",
      subarea: undefined,
    };
  }

  // Validate discipline
  const rawDiscipline = parts[0];
  const discipline: DisciplineId = DISCIPLINE_IDS.includes(
    rawDiscipline as DisciplineId
  )
    ? (rawDiscipline as DisciplineId)
    : "other";

  // Extract area and subarea
  const area = parts[1] ?? "misc";
  const subarea = parts[2];

  // If there are more than 3 parts, join the rest into subarea
  const fullSubarea = parts.length > 3 ? parts.slice(2).join(".") : subarea;

  return {
    discipline,
    area,
    subarea: fullSubarea,
  };
}

/**
 * Construct a domain ID string from a DomainPath.
 *
 * @param path - Structured domain path
 * @returns Domain ID string in format "<discipline>.<area>[.<subarea>]"
 *
 * @example
 * makeDomainId({ discipline: "math", area: "algebra", subarea: "linear-algebra" })
 * // => "math.algebra.linear-algebra"
 *
 * @example
 * makeDomainId({ discipline: "physics", area: "quantum-mechanics" })
 * // => "physics.quantum-mechanics"
 */
export function makeDomainId(path: DomainPath): string {
  const { discipline, area, subarea } = path;

  if (subarea) {
    return `${discipline}.${area}.${subarea}`;
  }

  return `${discipline}.${area}`;
}

// =============================================================================
// Extraction Helpers
// =============================================================================

/**
 * Extract the discipline from a domain ID.
 *
 * @param domainId - Domain ID string
 * @returns DisciplineId (defaults to "other" if invalid)
 *
 * @example
 * getDiscipline("math.algebra.linear-algebra") // => "math"
 * getDiscipline("unknown.stuff") // => "other"
 */
export function getDiscipline(domainId: string): DisciplineId {
  return parseDomainId(domainId).discipline;
}

/**
 * Extract the area from a domain ID.
 *
 * @param domainId - Domain ID string
 * @returns Area string (defaults to "misc" if missing)
 *
 * @example
 * getArea("math.algebra.linear-algebra") // => "algebra"
 * getArea("physics.quantum-mechanics") // => "quantum-mechanics"
 */
export function getArea(domainId: string): string {
  return parseDomainId(domainId).area;
}

/**
 * Extract the subarea from a domain ID.
 *
 * @param domainId - Domain ID string
 * @returns Subarea string or undefined if none
 *
 * @example
 * getSubarea("math.algebra.linear-algebra") // => "linear-algebra"
 * getSubarea("physics.quantum-mechanics") // => undefined
 */
export function getSubarea(domainId: string): string | undefined {
  return parseDomainId(domainId).subarea;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Domain ID validation regex.
 * Format: <word>.<word>[.<word>]*
 * Each segment is lowercase alphanumeric with hyphens allowed.
 */
const DOMAIN_ID_REGEX = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

/**
 * Check if a domain ID string is valid.
 *
 * Valid domain IDs:
 * - Have at least 2 segments (discipline.area)
 * - Each segment starts with a letter
 * - Segments contain only lowercase letters, numbers, and hyphens
 *
 * @param domainId - Domain ID string to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * isValidDomainId("math.algebra.linear-algebra") // => true
 * isValidDomainId("physics.quantum-mechanics") // => true
 * isValidDomainId("math") // => false (no area)
 * isValidDomainId("MATH.Algebra") // => false (uppercase)
 * isValidDomainId("math..algebra") // => false (empty segment)
 */
export function isValidDomainId(domainId: string): boolean {
  if (!domainId || typeof domainId !== "string") {
    return false;
  }

  return DOMAIN_ID_REGEX.test(domainId);
}

/**
 * Check if a domain ID has a known discipline.
 *
 * @param domainId - Domain ID string
 * @returns true if discipline is recognized
 */
export function hasKnownDiscipline(domainId: string): boolean {
  const { discipline } = parseDomainId(domainId);
  return discipline !== "other";
}

// =============================================================================
// Hierarchy Operations
// =============================================================================

/**
 * Get the parent domain ID (one level up).
 *
 * @param domainId - Domain ID string
 * @returns Parent domain ID, or undefined if already at top level
 *
 * @example
 * getParentDomain("math.algebra.linear-algebra") // => "math.algebra"
 * getParentDomain("math.algebra") // => undefined (can't go above area)
 */
export function getParentDomain(domainId: string): string | undefined {
  const { discipline, area, subarea } = parseDomainId(domainId);

  if (subarea) {
    return `${discipline}.${area}`;
  }

  // Can't go above discipline.area level
  return undefined;
}

/**
 * Check if one domain ID is an ancestor of another.
 *
 * @param ancestor - Potential ancestor domain ID
 * @param descendant - Potential descendant domain ID
 * @returns true if ancestor is a prefix of descendant
 *
 * @example
 * isDomainAncestor("math.algebra", "math.algebra.linear-algebra") // => true
 * isDomainAncestor("math", "math.algebra.linear-algebra") // => true
 * isDomainAncestor("math.analysis", "math.algebra.linear-algebra") // => false
 */
export function isDomainAncestor(
  ancestor: string,
  descendant: string
): boolean {
  if (ancestor === descendant) {
    return false;
  }

  return descendant.startsWith(ancestor + ".");
}

/**
 * Check if two domain IDs share the same discipline.
 *
 * @param domainId1 - First domain ID
 * @param domainId2 - Second domain ID
 * @returns true if same discipline
 */
export function sameDiscipline(domainId1: string, domainId2: string): boolean {
  return getDiscipline(domainId1) === getDiscipline(domainId2);
}

/**
 * Check if two domain IDs share the same discipline and area.
 *
 * @param domainId1 - First domain ID
 * @param domainId2 - Second domain ID
 * @returns true if same discipline and area
 */
export function sameArea(domainId1: string, domainId2: string): boolean {
  const path1 = parseDomainId(domainId1);
  const path2 = parseDomainId(domainId2);

  return path1.discipline === path2.discipline && path1.area === path2.area;
}

// =============================================================================
// Label Generation
// =============================================================================

import {
  DISCIPLINE_LABELS,
  MATH_AREA_LABELS,
  PHYSICS_AREA_LABELS,
  CS_AREA_LABELS,
  MATH_SUBAREA_LABELS_BY_AREA,
  PHYSICS_SUBAREA_LABELS_BY_AREA,
  type MathArea,
  type PhysicsArea,
} from "../types/domain-taxonomy";

/**
 * Get the label for a subarea within a given area.
 *
 * @param discipline - The discipline (math, physics, etc.)
 * @param area - The area within the discipline
 * @param subarea - The subarea to look up
 * @returns The human-readable label, or titleCase fallback
 */
function getSubareaLabel(
  discipline: string,
  area: string,
  subarea: string
): string {
  if (discipline === "math" && area in MATH_SUBAREA_LABELS_BY_AREA) {
    const labels = MATH_SUBAREA_LABELS_BY_AREA[area as MathArea];
    if (labels && subarea in labels) {
      return labels[subarea];
    }
  } else if (
    discipline === "physics" &&
    area in PHYSICS_SUBAREA_LABELS_BY_AREA
  ) {
    const labels = PHYSICS_SUBAREA_LABELS_BY_AREA[area as PhysicsArea];
    if (labels && subarea in labels) {
      return labels[subarea];
    }
  }
  return titleCase(subarea);
}

/**
 * Get a human-readable label for a domain ID.
 *
 * @param domainId - Domain ID string
 * @returns Human-readable label
 *
 * @example
 * getDomainLabel("math.algebra.linear-algebra")
 * // => "Mathematics › Algebra › Linear Algebra"
 *
 * @example
 * getDomainLabel("physics.quantum.schrodinger-equation")
 * // => "Physics › Quantum Physics › Schrödinger Equation"
 */
export function getDomainLabel(domainId: string): string {
  const { discipline, area, subarea } = parseDomainId(domainId);

  const disciplineLabel =
    DISCIPLINE_LABELS[discipline] ?? titleCase(discipline);

  // Try to get area label from known areas
  let areaLabel: string;
  if (discipline === "math" && area in MATH_AREA_LABELS) {
    areaLabel = MATH_AREA_LABELS[area as keyof typeof MATH_AREA_LABELS];
  } else if (discipline === "physics" && area in PHYSICS_AREA_LABELS) {
    areaLabel = PHYSICS_AREA_LABELS[area as keyof typeof PHYSICS_AREA_LABELS];
  } else if (discipline === "cs" && area in CS_AREA_LABELS) {
    areaLabel = CS_AREA_LABELS[area as keyof typeof CS_AREA_LABELS];
  } else {
    areaLabel = titleCase(area);
  }

  if (subarea) {
    const subareaLabel = getSubareaLabel(discipline, area, subarea);
    return `${disciplineLabel} › ${areaLabel} › ${subareaLabel}`;
  }

  return `${disciplineLabel} › ${areaLabel}`;
}

/**
 * Get a short label (just the most specific part).
 *
 * @param domainId - Domain ID string
 * @returns Short label (subarea if present, else area)
 *
 * @example
 * getShortDomainLabel("math.algebra.linear-algebra") // => "Linear Algebra"
 * getShortDomainLabel("physics.quantum") // => "Quantum Physics"
 */
export function getShortDomainLabel(domainId: string): string {
  const { discipline, area, subarea } = parseDomainId(domainId);

  if (subarea) {
    return getSubareaLabel(discipline, area, subarea);
  }

  // Try to get area label from known areas
  if (discipline === "math" && area in MATH_AREA_LABELS) {
    return MATH_AREA_LABELS[area as keyof typeof MATH_AREA_LABELS];
  } else if (discipline === "physics" && area in PHYSICS_AREA_LABELS) {
    return PHYSICS_AREA_LABELS[area as keyof typeof PHYSICS_AREA_LABELS];
  } else if (discipline === "cs" && area in CS_AREA_LABELS) {
    return CS_AREA_LABELS[area as keyof typeof CS_AREA_LABELS];
  }

  return titleCase(area);
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert kebab-case to Title Case.
 * @internal
 */
function titleCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
