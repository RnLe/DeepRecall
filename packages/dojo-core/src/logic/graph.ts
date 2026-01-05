/**
 * Concept graph utilities
 * Pure functions for graph operations (cycle detection, topological sort, etc.)
 */

import type {
  ConceptNode,
  ConceptGraph,
  ConceptNodeWithLevel,
  ConceptEdge,
} from "../types/concept";
import type { ConceptNodeId } from "../types/ids";

// =============================================================================
// Graph Construction
// =============================================================================

/**
 * Build an adjacency list from concept nodes
 * Maps each node to its prerequisites
 */
export function buildPrerequisiteMap(
  nodes: ConceptNode[]
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const node of nodes) {
    map.set(node.id, new Set(node.prerequisiteIds));
  }

  return map;
}

/**
 * Build a reverse adjacency list (dependents)
 * Maps each node to nodes that depend on it
 */
export function buildDependentMap(
  nodes: ConceptNode[]
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  // Initialize all nodes
  for (const node of nodes) {
    if (!map.has(node.id)) {
      map.set(node.id, new Set());
    }
  }

  // Build reverse edges
  for (const node of nodes) {
    for (const prereqId of node.prerequisiteIds) {
      const dependents = map.get(prereqId) ?? new Set();
      dependents.add(node.id);
      map.set(prereqId, dependents);
    }
  }

  return map;
}

// =============================================================================
// Cycle Detection
// =============================================================================

/**
 * Check if adding an edge would create a cycle
 * Uses DFS to check if target is reachable from source
 */
export function wouldCreateCycle(
  nodes: ConceptNode[],
  fromId: ConceptNodeId,
  toId: ConceptNodeId
): boolean {
  // Adding edge fromId -> toId means "fromId requires toId"
  // This creates a cycle if toId can already reach fromId

  const prereqMap = buildPrerequisiteMap(nodes);
  const visited = new Set<string>();

  function canReach(current: string, target: string): boolean {
    if (current === target) return true;
    if (visited.has(current)) return false;

    visited.add(current);

    const prerequisites = prereqMap.get(current) ?? new Set();
    for (const prereq of prerequisites) {
      if (canReach(prereq, target)) return true;
    }

    return false;
  }

  // Check if fromId is reachable from toId (via prerequisites)
  return canReach(toId, fromId);
}

/**
 * Detect all cycles in the graph
 * Returns list of cycles, each cycle is a list of node IDs
 */
export function detectCycles(nodes: ConceptNode[]): string[][] {
  const prereqMap = buildPrerequisiteMap(nodes);
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const prerequisites = prereqMap.get(nodeId) ?? new Set();
    for (const prereq of prerequisites) {
      if (!visited.has(prereq)) {
        dfs(prereq);
      } else if (recursionStack.has(prereq)) {
        // Found a cycle
        const cycleStart = path.indexOf(prereq);
        const cycle = path.slice(cycleStart);
        cycles.push([...cycle, prereq]);
      }
    }

    path.pop();
    recursionStack.delete(nodeId);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  }

  return cycles;
}

// =============================================================================
// Topological Sort & Levels
// =============================================================================

/**
 * Compute topological levels for all nodes
 * Level 0 = no prerequisites
 * Higher levels = more prerequisites
 */
export function computeLevels(nodes: ConceptNode[]): Map<string, number> {
  const levels = new Map<string, number>();
  const prereqMap = buildPrerequisiteMap(nodes);

  function getLevel(nodeId: string, visiting = new Set<string>()): number {
    if (levels.has(nodeId)) return levels.get(nodeId)!;

    // Detect cycle
    if (visiting.has(nodeId)) {
      console.warn(`Cycle detected at node ${nodeId}`);
      return 0;
    }

    visiting.add(nodeId);

    const prerequisites = prereqMap.get(nodeId);
    if (!prerequisites || prerequisites.size === 0) {
      levels.set(nodeId, 0);
      return 0;
    }

    let maxPrereqLevel = -1;
    for (const prereqId of prerequisites) {
      const prereqLevel = getLevel(prereqId, visiting);
      maxPrereqLevel = Math.max(maxPrereqLevel, prereqLevel);
    }

    const level = maxPrereqLevel + 1;
    levels.set(nodeId, level);
    return level;
  }

  for (const node of nodes) {
    getLevel(node.id);
  }

  return levels;
}

/**
 * Perform topological sort on nodes
 * Returns nodes in order such that prerequisites come before dependents
 */
export function topologicalSort(nodes: ConceptNode[]): ConceptNode[] {
  const levels = computeLevels(nodes);

  return [...nodes].sort((a, b) => {
    const levelA = levels.get(a.id) ?? 0;
    const levelB = levels.get(b.id) ?? 0;
    if (levelA !== levelB) return levelA - levelB;
    // Within same level, sort by name
    return a.name.localeCompare(b.name);
  });
}

/**
 * Enrich nodes with level and dependent information
 */
export function enrichNodesWithLevels(
  nodes: ConceptNode[]
): ConceptNodeWithLevel[] {
  const levels = computeLevels(nodes);
  const dependentMap = buildDependentMap(nodes);

  return nodes.map((node) => ({
    ...node,
    level: levels.get(node.id) ?? 0,
    dependentIds: [...(dependentMap.get(node.id) ?? [])] as ConceptNodeId[],
  }));
}

// =============================================================================
// Reachability
// =============================================================================

/**
 * Get all ancestors (transitive prerequisites) of a node
 */
export function getAncestors(
  nodes: ConceptNode[],
  nodeId: ConceptNodeId
): Set<string> {
  const prereqMap = buildPrerequisiteMap(nodes);
  const ancestors = new Set<string>();
  const queue = [...(prereqMap.get(nodeId) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!ancestors.has(current)) {
      ancestors.add(current);
      const prereqs = prereqMap.get(current) ?? new Set();
      queue.push(...prereqs);
    }
  }

  return ancestors;
}

/**
 * Get all descendants (transitive dependents) of a node
 */
export function getDescendants(
  nodes: ConceptNode[],
  nodeId: ConceptNodeId
): Set<string> {
  const dependentMap = buildDependentMap(nodes);
  const descendants = new Set<string>();
  const queue = [...(dependentMap.get(nodeId) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!descendants.has(current)) {
      descendants.add(current);
      const dependents = dependentMap.get(current) ?? new Set();
      queue.push(...dependents);
    }
  }

  return descendants;
}

// =============================================================================
// Subgraph Extraction
// =============================================================================

/**
 * Extract a subgraph containing a node and its neighborhood
 * Includes ancestors up to a certain depth and descendants up to a certain depth
 */
export function extractNeighborhood(
  nodes: ConceptNode[],
  centerNodeId: ConceptNodeId,
  ancestorDepth = 2,
  descendantDepth = 2
): ConceptGraph {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const prereqMap = buildPrerequisiteMap(nodes);
  const dependentMap = buildDependentMap(nodes);
  const includedIds = new Set<string>();

  // BFS for ancestors
  function collectAncestors(startId: string, maxDepth: number): void {
    const queue: Array<{ id: string; depth: number }> = [
      { id: startId, depth: 0 },
    ];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (includedIds.has(id) && depth > 0) continue;

      includedIds.add(id);

      if (depth < maxDepth) {
        const prereqs = prereqMap.get(id) ?? new Set();
        for (const prereq of prereqs) {
          queue.push({ id: prereq, depth: depth + 1 });
        }
      }
    }
  }

  // BFS for descendants
  function collectDescendants(startId: string, maxDepth: number): void {
    const queue: Array<{ id: string; depth: number }> = [
      { id: startId, depth: 0 },
    ];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (includedIds.has(id) && depth > 0) continue;

      includedIds.add(id);

      if (depth < maxDepth) {
        const dependents = dependentMap.get(id) ?? new Set();
        for (const dependent of dependents) {
          queue.push({ id: dependent, depth: depth + 1 });
        }
      }
    }
  }

  collectAncestors(centerNodeId, ancestorDepth);
  collectDescendants(centerNodeId, descendantDepth);

  // Build subgraph
  const subgraphNodes = [...includedIds]
    .map((id) => nodeMap.get(id as ConceptNodeId))
    .filter((n): n is ConceptNode => n !== undefined);

  const edges: ConceptEdge[] = [];
  for (const node of subgraphNodes) {
    for (const prereqId of node.prerequisiteIds) {
      if (includedIds.has(prereqId)) {
        edges.push({ fromId: node.id, toId: prereqId });
      }
    }
  }

  return { nodes: subgraphNodes, edges };
}

// =============================================================================
// Graph Validation
// =============================================================================

/**
 * Validate graph integrity
 * Checks for cycles, orphan references, and other issues
 */
export function validateGraph(nodes: ConceptNode[]): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Check for cycles
  const cycles = detectCycles(nodes);
  if (cycles.length > 0) {
    issues.push(`Found ${cycles.length} cycle(s) in the graph`);
    for (const cycle of cycles) {
      issues.push(`  Cycle: ${cycle.join(" -> ")}`);
    }
  }

  // Check for orphan references
  for (const node of nodes) {
    for (const prereqId of node.prerequisiteIds) {
      if (!nodeIds.has(prereqId)) {
        issues.push(
          `Node "${node.name}" references non-existent prerequisite: ${prereqId}`
        );
      }
    }
  }

  // Check for self-references
  for (const node of nodes) {
    if (node.prerequisiteIds.includes(node.id as ConceptNodeId)) {
      issues.push(`Node "${node.name}" references itself as a prerequisite`);
    }
  }

  // Check for duplicate slugs
  const slugs = new Set<string>();
  for (const node of nodes) {
    if (slugs.has(node.slug)) {
      issues.push(`Duplicate slug: ${node.slug}`);
    }
    slugs.add(node.slug);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
