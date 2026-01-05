/**
 * Concepts Local Repository (Optimistic Layer)
 *
 * Instant writes to Dexie, queued for background sync via WriteBuffer.
 * Provides immediate UI feedback while data syncs in the background.
 */

import type {
  ConceptNode,
  ConceptNodeCreate,
  ConceptNodeId,
} from "@deeprecall/dojo-core";
import { asConceptNodeId } from "@deeprecall/dojo-core";
import { createWriteBuffer, isAuthenticated } from "@deeprecall/data";
import { logger } from "@deeprecall/telemetry";
import { dojoDb } from "../db";
import { conceptNodeToRow } from "../mappers";
import type { DojoConceptNodeRow } from "../types/rows";

const buffer = createWriteBuffer();

/**
 * Create a new concept node (instant local write)
 */
export async function createConceptNodeLocal(
  input: ConceptNodeCreate,
  ownerId: string
): Promise<ConceptNode> {
  const now = new Date().toISOString();
  const id = asConceptNodeId(crypto.randomUUID());

  const concept: ConceptNode = {
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
  };

  const row = conceptNodeToRow(concept, ownerId);

  // Write to local table (instant)
  await dojoDb.dojo_concept_nodes_local.add({
    id: concept.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: row,
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_concept_nodes",
      op: "insert",
      payload: row,
    });
  }

  logger.info("db.local", "Created concept node (pending sync)", {
    conceptId: id,
    name: input.name,
    domainId: input.domainId,
    willSync: isAuthenticated(),
  });

  return concept;
}

/**
 * Update a concept node (instant local write)
 */
export async function updateConceptNodeLocal(
  id: ConceptNodeId,
  updates: Partial<Omit<ConceptNode, "id" | "createdAt">>,
  ownerId: string
): Promise<void> {
  const now = new Date().toISOString();

  // Convert to snake_case for DB
  const payload: Partial<DojoConceptNodeRow> & {
    id: string;
    owner_id: string;
  } = {
    id,
    owner_id: ownerId,
    updated_at: now,
  };

  // Map camelCase to snake_case
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.slug !== undefined) payload.slug = updates.slug;
  if (updates.description !== undefined)
    payload.description = updates.description ?? null;
  if (updates.domainId !== undefined) payload.domain_id = updates.domainId;
  if (updates.difficulty !== undefined) payload.difficulty = updates.difficulty;
  if (updates.importance !== undefined) payload.importance = updates.importance;
  if (updates.prerequisiteIds !== undefined) {
    payload.prerequisite_ids = updates.prerequisiteIds.map(
      (pid) => pid as string
    );
  }
  if (updates.tagIds !== undefined) payload.tag_ids = updates.tagIds ?? [];
  if (updates.relatedAnnotationIds !== undefined) {
    payload.related_annotation_ids = updates.relatedAnnotationIds ?? [];
  }
  if (updates.relatedDocumentIds !== undefined) {
    payload.related_document_ids = updates.relatedDocumentIds ?? [];
  }
  if (updates.relatedBoardIds !== undefined) {
    payload.related_board_ids = updates.relatedBoardIds ?? [];
  }

  // Write to local table (instant)
  await dojoDb.dojo_concept_nodes_local.add({
    id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: payload as DojoConceptNodeRow,
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_concept_nodes",
      op: "update",
      payload,
    });
  }

  logger.info("db.local", "Updated concept node (pending sync)", {
    conceptId: id,
    willSync: isAuthenticated(),
  });
}

/**
 * Delete a concept node (instant local write)
 */
export async function deleteConceptNodeLocal(
  id: ConceptNodeId,
  ownerId: string
): Promise<void> {
  // Write to local table (instant)
  await dojoDb.dojo_concept_nodes_local.add({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "dojo_concept_nodes",
      op: "delete",
      payload: { id, owner_id: ownerId },
    });
  }

  logger.info("db.local", "Deleted concept node (pending sync)", {
    conceptId: id,
    willSync: isAuthenticated(),
  });
}
