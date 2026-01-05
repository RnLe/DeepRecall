/**
 * Concepts Electric Repository
 *
 * Read-path: Electric shapes syncing from Postgres
 * Write-path: WriteBuffer queue → /api/writes/batch → Postgres → Electric
 */

import type {
  ConceptNode,
  ConceptNodeCreate,
  ConceptNodeId,
} from "@deeprecall/dojo-core";
import { asConceptNodeId } from "@deeprecall/dojo-core";
import { useShape, createWriteBuffer } from "@deeprecall/data";
import { logger } from "@deeprecall/telemetry";
import type { DojoConceptNodeRow } from "../types/rows";
import { conceptNodeToDomain, conceptNodeToRow } from "../mappers";

// =============================================================================
// Electric Read Hooks
// =============================================================================

/**
 * React hook to get all concept nodes (live-synced from Postgres)
 * Includes both user-owned content and global content (is_global = true)
 * @param userId - Owner filter for multi-tenant isolation
 */
export function useConceptNodes(userId?: string) {
  // Include both user's own content AND global content
  const whereClause = userId
    ? `(owner_id = '${userId}' OR is_global = true)`
    : undefined;

  const result = useShape<DojoConceptNodeRow>({
    table: "dojo_concept_nodes",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.map(conceptNodeToDomain),
  };
}

/**
 * React hook to get concept nodes by domain
 * Includes both user-owned content and global content (is_global = true)
 */
export function useConceptNodesByDomain(domainId: string, userId?: string) {
  // Include both user's own content AND global content for the domain
  const whereClause = userId
    ? `(owner_id = '${userId}' OR is_global = true) AND domain_id = '${domainId}'`
    : `domain_id = '${domainId}'`;

  const result = useShape<DojoConceptNodeRow>({
    table: "dojo_concept_nodes",
    where: whereClause,
  });

  return {
    ...result,
    data: result.data?.map(conceptNodeToDomain),
  };
}

/**
 * React hook to get a single concept node by ID
 */
export function useConceptNode(id: ConceptNodeId | undefined) {
  const result = useShape<DojoConceptNodeRow>({
    table: "dojo_concept_nodes",
    where: id ? `id = '${id}'` : undefined,
  });

  return {
    ...result,
    data: result.data?.[0] ? conceptNodeToDomain(result.data[0]) : undefined,
  };
}

// =============================================================================
// Write Operations
// =============================================================================

const buffer = createWriteBuffer();

/**
 * Create a new concept node
 */
export async function createConceptNode(
  data: ConceptNodeCreate,
  ownerId: string
): Promise<ConceptNode> {
  const now = new Date().toISOString();
  const id = asConceptNodeId(crypto.randomUUID());

  const concept: ConceptNode = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  const row = conceptNodeToRow(concept, ownerId);

  await buffer.enqueue({
    table: "dojo_concept_nodes",
    op: "insert",
    payload: row,
  });

  logger.info("db.local", "Created concept node (enqueued)", {
    conceptId: id,
    name: data.name,
    domainId: data.domainId,
  });

  return concept;
}

/**
 * Update a concept node
 */
export async function updateConceptNode(
  id: ConceptNodeId,
  updates: Partial<Omit<ConceptNode, "id" | "createdAt">>,
  ownerId: string
): Promise<void> {
  const now = new Date().toISOString();

  const payload = {
    id,
    owner_id: ownerId,
    ...snakeCaseUpdates(updates),
    updated_at: now,
  };

  await buffer.enqueue({
    table: "dojo_concept_nodes",
    op: "update",
    payload,
  });

  logger.info("db.local", "Updated concept node (enqueued)", {
    conceptId: id,
  });
}

/**
 * Delete a concept node
 */
export async function deleteConceptNode(
  id: ConceptNodeId,
  ownerId: string
): Promise<void> {
  await buffer.enqueue({
    table: "dojo_concept_nodes",
    op: "delete",
    payload: { id, owner_id: ownerId },
  });

  logger.info("db.local", "Deleted concept node (enqueued)", {
    conceptId: id,
  });
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert camelCase update keys to snake_case for DB
 */
function snakeCaseUpdates(updates: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(updates)) {
    const snakeKey = key.replace(
      /[A-Z]/g,
      (letter) => `_${letter.toLowerCase()}`
    );
    result[snakeKey] = value;
  }

  return result;
}
