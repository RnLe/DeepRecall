/**
 * Annotation Repository - CRUD operations for annotations in Dexie
 * Following DeepRecall mental model: deterministic IDs, local-first, type-safe
 */

import { db } from "../db/dexie";
import type {
  Annotation,
  CreateAnnotationInput,
  UpdateAnnotationInput,
  AnnotationFilters,
} from "../schema/annotation";
import { AnnotationSchema } from "../schema/annotation";
import {
  generateAnnotationId,
  extractRectanglesForId,
} from "../utils/annotation-id";

/**
 * Create a new annotation with deterministic ID
 * Idempotent: same coordinates = same ID = no duplicates
 */
export async function createAnnotation(
  input: CreateAnnotationInput
): Promise<Annotation> {
  const now = Date.now();

  // Generate deterministic ID
  const coords = extractRectanglesForId(input.data);
  const id = await generateAnnotationId(
    input.sha256,
    input.page,
    input.data.type,
    coords
  );

  const annotation: Annotation = {
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
  };

  // Validate with Zod
  const validated = AnnotationSchema.parse(annotation);

  // Check if annotation already exists (idempotency)
  const existing = await db.annotations.get(id);
  if (existing) {
    // Update timestamps and metadata if it exists
    const updated: Annotation = {
      ...existing,
      metadata: { ...existing.metadata, ...input.metadata },
      updatedAt: now,
    };
    await db.annotations.put(updated);
    return updated;
  }

  // Insert new annotation
  await db.annotations.add(validated);
  return validated;
}

/**
 * Get annotation by ID
 */
export async function getAnnotation(id: string): Promise<Annotation | null> {
  const ann = await db.annotations.get(id);
  return ann ?? null;
}

/**
 * Update annotation
 * Only metadata can be updated; geometry changes create a new annotation
 */
export async function updateAnnotation(
  input: UpdateAnnotationInput
): Promise<Annotation | null> {
  const existing = await db.annotations.get(input.id);
  if (!existing) return null;

  const updated: Annotation = {
    ...existing,
    ...input,
    updatedAt: Date.now(),
  };

  // Validate
  const validated = AnnotationSchema.parse(updated);

  await db.annotations.put(validated);
  return validated;
}

/**
 * Delete annotation
 */
export async function deleteAnnotation(id: string): Promise<boolean> {
  await db.annotations.delete(id);
  return true;
}

/**
 * List annotations with filters
 */
export async function listAnnotations(
  filters: AnnotationFilters = {}
): Promise<Annotation[]> {
  let query = db.annotations.toCollection();

  // Filter by PDF hash
  if (filters.sha256) {
    query = db.annotations.where("sha256").equals(filters.sha256);
  }

  // Filter by page (compound index for efficiency)
  if (filters.sha256 && filters.page !== undefined) {
    query = db.annotations
      .where("[sha256+page]")
      .equals([filters.sha256, filters.page]);
  } else if (filters.page !== undefined) {
    query = db.annotations.where("page").equals(filters.page);
  }

  // Filter by type
  if (filters.type) {
    query = query.filter((ann) => ann.data.type === filters.type);
  }

  // Filter by tags
  if (filters.tags && filters.tags.length > 0) {
    query = query.filter((ann) =>
      filters.tags!.some((tag) => ann.metadata.tags?.includes(tag))
    );
  }

  // Filter by date range
  if (filters.fromDate) {
    query = query.filter((ann) => ann.createdAt >= filters.fromDate!);
  }
  if (filters.toDate) {
    query = query.filter((ann) => ann.createdAt <= filters.toDate!);
  }

  return query.toArray();
}

/**
 * Get annotations for a specific PDF page
 * Optimized with compound index
 */
export async function getPageAnnotations(
  sha256: string,
  page: number
): Promise<Annotation[]> {
  return db.annotations.where("[sha256+page]").equals([sha256, page]).toArray();
}

/**
 * Get all annotations for a PDF
 */
export async function getPDFAnnotations(sha256: string): Promise<Annotation[]> {
  return db.annotations.where("sha256").equals(sha256).toArray();
}

/**
 * Bulk create annotations (for import)
 * Uses deterministic IDs to avoid duplicates
 */
export async function bulkCreateAnnotations(
  inputs: CreateAnnotationInput[]
): Promise<Annotation[]> {
  const annotations = await Promise.all(inputs.map(createAnnotation));
  return annotations;
}

/**
 * Count annotations by PDF
 */
export async function countPDFAnnotations(sha256: string): Promise<number> {
  return db.annotations.where("sha256").equals(sha256).count();
}

/**
 * Get recent annotations (for activity feed)
 */
export async function getRecentAnnotations(
  limit: number = 10
): Promise<Annotation[]> {
  return db.annotations.orderBy("createdAt").reverse().limit(limit).toArray();
}

/**
 * Search annotations by text content (highlight annotations only)
 */
export async function searchAnnotationsByText(
  query: string
): Promise<Annotation[]> {
  const lowerQuery = query.toLowerCase();
  return db.annotations
    .filter((ann) => {
      if (ann.data.type === "highlight") {
        return ann.data.ranges.some((range) =>
          range.text.toLowerCase().includes(lowerQuery)
        );
      }
      return false;
    })
    .toArray();
}

/**
 * Export all annotations as JSON (for backup)
 */
export async function exportAnnotations(): Promise<Annotation[]> {
  return db.annotations.toArray();
}

/**
 * Import annotations from JSON (with deduplication via deterministic IDs)
 */
export async function importAnnotations(
  annotations: CreateAnnotationInput[]
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const input of annotations) {
    const coords = extractRectanglesForId(input.data);
    const id = await generateAnnotationId(
      input.sha256,
      input.page,
      input.data.type,
      coords
    );

    const existing = await db.annotations.get(id);
    if (existing) {
      updated++;
    } else {
      created++;
    }

    await createAnnotation(input);
  }

  return { created, updated };
}
