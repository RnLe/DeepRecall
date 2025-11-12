/**
 * Local repository for Annotation entities (Optimistic Layer)
 * Instant writes to Dexie, queued for background sync
 */

import type {
  Annotation,
  CreateAnnotationInput,
  UpdateAnnotationInput,
} from "@deeprecall/core";
import {
  AnnotationSchema,
  generateAnnotationId,
  extractRectanglesForId,
} from "@deeprecall/core";
import { db } from "../db";
import { createWriteBuffer } from "../writeBuffer";
import { logger } from "@deeprecall/telemetry";
import { isAuthenticated } from "../auth";

const buffer = createWriteBuffer();

/**
 * Create a new annotation (instant local write)
 * Uses deterministic ID generation for idempotency
 */
export async function createAnnotationLocal(
  input: CreateAnnotationInput,
): Promise<Annotation> {
  const now = Date.now();

  // Generate deterministic ID
  const coords = extractRectanglesForId(input.data);
  const id = await generateAnnotationId(
    input.sha256,
    input.page,
    input.data.type,
    coords,
  );

  const annotation: Annotation = {
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
  };

  const validated = AnnotationSchema.parse(annotation);

  // Write to local table (instant)
  await db.annotations_local.add({
    id: validated.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: validated,
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "annotations",
      op: "insert",
      payload: validated,
    });
  }

  logger.info("db.local", "Created annotation (pending sync)", {
    annotationId: annotation.id,
    sha256: input.sha256.slice(0, 16),
    page: input.page,
    type: input.data.type,
    willSync: isAuthenticated(),
  });
  return validated;
}

/**
 * Update an annotation (instant local write)
 * Only metadata can be updated; geometry changes create a new annotation
 */
export async function updateAnnotationLocal(
  input: UpdateAnnotationInput,
): Promise<void> {
  const now = Date.now();
  const updated = {
    ...input,
    updatedAt: now,
  };

  // Write to local table (instant)
  await db.annotations_local.add({
    id: input.id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: updated as any, // Partial update data
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "annotations",
      op: "update",
      payload: updated,
    });
  }

  logger.info("db.local", "Updated annotation (pending sync)", {
    annotationId: input.id,
    willSync: isAuthenticated(),
  });
}

/**
 * Delete an annotation (instant local write)
 */
export async function deleteAnnotationLocal(id: string): Promise<void> {
  // Write to local table (instant)
  await db.annotations_local.add({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
    data: { id } as any, // Delete only needs ID
  });

  // Enqueue for server sync (background, only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "annotations",
      op: "delete",
      payload: { id },
    });
  }

  logger.info("db.local", "Deleted annotation (pending sync)", {
    annotationId: id,
    willSync: isAuthenticated(),
  });
}
