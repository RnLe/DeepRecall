/**
 * ConceptNode and related types
 * Concepts form the knowledge graph that underlies the Dojo
 */

import type { ConceptNodeId } from "./ids";
import type {
  DomainId,
  DifficultyLevel,
  ImportanceLevel,
  ConceptKind,
} from "./enums";

// =============================================================================
// Core Concept Types
// =============================================================================

/**
 * A node in the concept knowledge graph
 * Represents a single concept/topic that can be learned and mastered
 */
export interface ConceptNode {
  /** Unique identifier */
  id: ConceptNodeId;

  /**
   * Hierarchical domain this concept belongs to
   *
   * Format: "<discipline>.<area>[.<subarea>]"
   * Example: "math.algebra.linear-algebra"
   */
  domainId: DomainId;

  /** Display name (e.g., "Eigenvalues of Hermitian Operators") */
  name: string;

  /** URL-friendly slug (e.g., "eigenvalues-hermitian-operators") */
  slug: string;

  /** Optional longer description (Markdown/LaTeX supported) */
  description?: string;

  /**
   * Semantic kind of this concept
   *
   * Determines UI display (icons, styling) and affects learning recommendations.
   * Examples: "theorem", "definition", "technique", "object"
   */
  conceptKind: ConceptKind;

  /** Difficulty level within the domain */
  difficulty: DifficultyLevel;

  /** How important this concept is to the curriculum */
  importance: ImportanceLevel;

  // ===== Graph Structure =====

  /** IDs of prerequisite concepts (edges pointing "downward" in the DAG) */
  prerequisiteIds: ConceptNodeId[];

  /** Optional semantic tags for filtering/searching */
  tagIds?: string[];

  // ===== DeepRecall Integration (optional) =====

  /** Related annotation IDs from the PDF reader */
  relatedAnnotationIds?: string[];

  /** Related document IDs */
  relatedDocumentIds?: string[];

  /** Related whiteboard/board IDs */
  relatedBoardIds?: string[];

  // ===== Global Content Flag =====

  /** Whether this is global content (visible to all users) vs user-owned */
  isGlobal?: boolean;

  // ===== Metadata =====

  /** When this concept was created */
  createdAt: string;

  /** When this concept was last updated */
  updatedAt: string;
}

/**
 * Input for creating a new concept (without generated fields)
 */
export type ConceptNodeCreate = Omit<
  ConceptNode,
  "id" | "createdAt" | "updatedAt"
>;

/**
 * Input for updating a concept (all fields optional except id)
 */
export type ConceptNodeUpdate = Partial<
  Omit<ConceptNode, "id" | "createdAt" | "updatedAt">
> & {
  id: ConceptNodeId;
};

// =============================================================================
// Concept Graph Types
// =============================================================================

/**
 * An edge in the concept graph (A requires B)
 */
export interface ConceptEdge {
  /** The concept that has the prerequisite */
  fromId: ConceptNodeId;

  /** The prerequisite concept */
  toId: ConceptNodeId;

  /** Optional weight/strength of the dependency (0-1) */
  weight?: number;
}

/**
 * A subgraph of concepts for visualization or analysis
 */
export interface ConceptGraph {
  /** All nodes in this subgraph */
  nodes: ConceptNode[];

  /** All edges in this subgraph */
  edges: ConceptEdge[];
}

/**
 * Computed level information for DAG layout
 */
export interface ConceptNodeWithLevel extends ConceptNode {
  /** DAG level (0 = no prerequisites, higher = more prerequisites) */
  level: number;

  /** Computed dependents (concepts that require this one) */
  dependentIds: ConceptNodeId[];
}

// =============================================================================
// Concept Filters
// =============================================================================

/**
 * Filter options for querying concepts
 */
export interface ConceptFilter {
  domainId?: DomainId;
  difficulty?: DifficultyLevel;
  importance?: ImportanceLevel;
  tagIds?: string[];
  searchQuery?: string;
}
