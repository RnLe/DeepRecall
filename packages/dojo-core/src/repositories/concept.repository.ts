/**
 * Repository interfaces for Concept-related data access
 * These abstractions allow swapping storage implementations
 */

import type {
  ConceptNode,
  ConceptNodeCreate,
  ConceptNodeUpdate,
  ConceptGraph,
  ConceptFilter,
} from "../types/concept";
import type { ConceptNodeId, UserId } from "../types/ids";
import type { DomainId } from "../types/enums";

// =============================================================================
// ConceptRepository Interface
// =============================================================================

/**
 * Repository for ConceptNode CRUD operations
 */
export interface ConceptRepository {
  // ===== Read Operations =====

  /**
   * Get a concept by ID
   */
  getById(id: ConceptNodeId): Promise<ConceptNode | null>;

  /**
   * Get a concept by slug
   */
  getBySlug(slug: string): Promise<ConceptNode | null>;

  /**
   * Get multiple concepts by IDs
   */
  getByIds(ids: ConceptNodeId[]): Promise<ConceptNode[]>;

  /**
   * List all concepts in a domain
   */
  listByDomain(domainId: DomainId): Promise<ConceptNode[]>;

  /**
   * List concepts matching a filter
   */
  list(filter?: ConceptFilter): Promise<ConceptNode[]>;

  /**
   * Get all concepts (for graph building)
   */
  listAll(): Promise<ConceptNode[]>;

  /**
   * Search concepts by name/description
   */
  search(query: string, limit?: number): Promise<ConceptNode[]>;

  // ===== Write Operations =====

  /**
   * Create a new concept
   */
  create(data: ConceptNodeCreate): Promise<ConceptNode>;

  /**
   * Update an existing concept
   */
  update(data: ConceptNodeUpdate): Promise<ConceptNode>;

  /**
   * Delete a concept by ID
   */
  delete(id: ConceptNodeId): Promise<void>;

  // ===== Graph Operations =====

  /**
   * Get the full concept graph for a domain
   */
  getGraph(domainId: DomainId): Promise<ConceptGraph>;

  /**
   * Get direct prerequisites of a concept
   */
  getPrerequisites(id: ConceptNodeId): Promise<ConceptNode[]>;

  /**
   * Get direct dependents of a concept (concepts that require this one)
   */
  getDependents(id: ConceptNodeId): Promise<ConceptNode[]>;

  /**
   * Get all ancestors (transitive prerequisites)
   */
  getAncestors(id: ConceptNodeId): Promise<ConceptNode[]>;

  /**
   * Get all descendants (transitive dependents)
   */
  getDescendants(id: ConceptNodeId): Promise<ConceptNode[]>;

  /**
   * Check if the graph would be cyclic after adding an edge
   */
  wouldCreateCycle(
    fromId: ConceptNodeId,
    toId: ConceptNodeId
  ): Promise<boolean>;
}

// =============================================================================
// ConceptBrickRepository Interface
// =============================================================================

import type { ConceptBrickState, BrickMastery } from "../types/brick";

/**
 * Repository for concept brick states (user-specific mastery data)
 */
export interface ConceptBrickRepository {
  /**
   * Get brick state for a user/concept pair
   */
  get(
    userId: UserId,
    conceptId: ConceptNodeId
  ): Promise<ConceptBrickState | null>;

  /**
   * Get all brick states for a user
   */
  listByUser(userId: UserId): Promise<ConceptBrickState[]>;

  /**
   * Get brick states for specific concepts
   */
  listByUserAndConcepts(
    userId: UserId,
    conceptIds: ConceptNodeId[]
  ): Promise<ConceptBrickState[]>;

  /**
   * Get brick states for a domain
   */
  listByUserAndDomain(
    userId: UserId,
    domainId: DomainId
  ): Promise<ConceptBrickState[]>;

  /**
   * Create or update a brick state
   */
  upsert(
    userId: UserId,
    conceptId: ConceptNodeId,
    metrics: BrickMastery
  ): Promise<ConceptBrickState>;

  /**
   * Delete a brick state
   */
  delete(userId: UserId, conceptId: ConceptNodeId): Promise<void>;

  /**
   * Get concepts due for review (based on associated exercises)
   */
  listDue(userId: UserId, before?: Date): Promise<ConceptBrickState[]>;
}
