/**
 * Repository for Annotation entities (Electric + WriteBuffer version)
 * Read-path: Electric shapes syncing from Postgres
 * Write-path: WriteBuffer queue → /api/writes/batch → Postgres → Electric
 *
 * Note: Maintains deterministic ID generation for idempotency
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
import { useShape } from "../electric";
import { createWriteBuffer } from "../writeBuffer";

/**
 * React hook to get all annotations for a PDF (live-synced from Postgres)
 */
export function usePDFAnnotations(sha256: string) {
  return useShape<Annotation>({
    table: "annotations",
    where: `sha256 = '${sha256}'`,
  });
}

/**
 * React hook to get annotations for a specific page
 */
export function usePageAnnotations(sha256: string, page: number) {
  return useShape<Annotation>({
    table: "annotations",
    where: `sha256 = '${sha256}' AND page = ${page}`,
  });
}

/**
 * React hook to get a single annotation by ID
 */
export function useAnnotation(id: string | undefined) {
  const result = useShape<Annotation>({
    table: "annotations",
    where: id ? `id = '${id}'` : undefined,
  });

  return {
    ...result,
    data: result.data?.[0],
  };
}

/**
 * React hook to get all annotations (use sparingly, prefer filtered queries)
 */
export function useAnnotations() {
  return useShape<Annotation>({
    table: "annotations",
  });
}

/**
 * React hook to get recent annotations
 */
export function useRecentAnnotations(limit: number = 10) {
  const { data, ...rest } = useShape<Annotation>({
    table: "annotations",
  });

  return {
    ...rest,
    data: data?.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit),
  };
}

/**
 * Get write buffer instance
 */
const buffer = createWriteBuffer();

/**
 * Create a new annotation with deterministic ID (optimistic)
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

  // Enqueue to write buffer (server will handle idempotency)
  await buffer.enqueue({
    table: "annotations",
    op: "insert",
    payload: validated,
  });

  console.log(`[AnnotationsRepo] Created annotation ${id} (enqueued for sync)`);
  return validated;
}

/**
 * Update annotation (optimistic)
 * Only metadata can be updated; geometry changes create a new annotation
 */
export async function updateAnnotation(
  input: UpdateAnnotationInput
): Promise<void> {
  const updated = {
    ...input,
    updatedAt: Date.now(),
  };

  // Validate
  const validated = AnnotationSchema.parse(updated as Annotation);

  await buffer.enqueue({
    table: "annotations",
    op: "update",
    payload: validated,
  });

  console.log(
    `[AnnotationsRepo] Updated annotation ${input.id} (enqueued for sync)`
  );
}

/**
 * Delete annotation (optimistic)
 */
export async function deleteAnnotation(id: string): Promise<void> {
  await buffer.enqueue({
    table: "annotations",
    op: "delete",
    payload: { id },
  });

  console.log(`[AnnotationsRepo] Deleted annotation ${id} (enqueued for sync)`);
}

/**
 * Bulk create annotations (for import)
 * Each creates a deterministic ID
 */
export async function bulkCreateAnnotations(
  inputs: CreateAnnotationInput[]
): Promise<Annotation[]> {
  const annotations = await Promise.all(inputs.map(createAnnotation));
  return annotations;
}

/**
 * Client-side filters for annotations
 */
export function filterAnnotations(
  annotations: Annotation[],
  filters: {
    type?: string;
    tags?: string[];
    fromDate?: number;
    toDate?: number;
  }
): Annotation[] {
  let filtered = annotations;

  if (filters.type) {
    filtered = filtered.filter((ann) => ann.data.type === filters.type);
  }

  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter((ann) =>
      filters.tags!.some((tag) => ann.metadata.tags?.includes(tag))
    );
  }

  if (filters.fromDate) {
    filtered = filtered.filter((ann) => ann.createdAt >= filters.fromDate!);
  }

  if (filters.toDate) {
    filtered = filtered.filter((ann) => ann.createdAt <= filters.toDate!);
  }

  return filtered;
}

/**
 * Search annotations by text content (client-side)
 */
export function searchAnnotationsByText(
  annotations: Annotation[],
  query: string
): Annotation[] {
  const lowerQuery = query.toLowerCase();
  return annotations.filter((ann) => {
    if (ann.data.type === "highlight") {
      return ann.data.ranges.some((range) =>
        range.text.toLowerCase().includes(lowerQuery)
      );
    }
    return false;
  });
}

/**
 * Count annotations (client-side)
 */
export function countAnnotations(annotations: Annotation[]): number {
  return annotations.length;
}
