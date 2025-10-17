/**
 * Annotation Schema - Types and validation for PDF annotations
 * Following DeepRecall mental model: local-first, deterministic IDs, normalized coordinates
 */

import { z } from "zod";

/* ────────────────────── Normalized Coordinate Types ────────────────────── */

/**
 * Normalized rectangle (0-1 range, zoom-proof)
 * Used for both rectangle annotations and text highlight bounding boxes
 */
export const NormalizedRectSchema = z.object({
  x: z.number().min(0).max(1), // left edge
  y: z.number().min(0).max(1), // top edge
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

export type NormalizedRect = z.infer<typeof NormalizedRectSchema>;

/**
 * Text range with bounding rectangles
 * For highlight annotations that span multiple lines/areas
 */
export const TextRangeSchema = z.object({
  text: z.string(),
  rects: z.array(NormalizedRectSchema).min(1), // Bounding boxes for this text range
});

export type TextRange = z.infer<typeof TextRangeSchema>;

/* ────────────────────── Annotation Type Discriminators ────────────────────── */

export type AnnotationType = "rectangle" | "highlight";

export const annotationTypes: AnnotationType[] = ["rectangle", "highlight"];

/* ────────────────────── Type-Specific Schemas ────────────────────── */

/**
 * Rectangle annotation - can be a single rect or union of multiple rects (polygon with right angles)
 */
export const RectangleAnnotationDataSchema = z.object({
  type: z.literal("rectangle"),
  rects: z.array(NormalizedRectSchema).min(1), // Multiple rects = complex polygon
});

export type RectangleAnnotationData = z.infer<
  typeof RectangleAnnotationDataSchema
>;

/**
 * Highlight annotation - one or more text ranges with their bounding boxes
 */
export const HighlightAnnotationDataSchema = z.object({
  type: z.literal("highlight"),
  ranges: z.array(TextRangeSchema).min(1), // Multiple ranges = multi-selection highlight
});

export type HighlightAnnotationData = z.infer<
  typeof HighlightAnnotationDataSchema
>;

/**
 * Discriminated union of annotation data types
 */
export const AnnotationDataSchema = z.discriminatedUnion("type", [
  RectangleAnnotationDataSchema,
  HighlightAnnotationDataSchema,
]);

export type AnnotationData = z.infer<typeof AnnotationDataSchema>;

/* ────────────────────── Common Metadata ────────────────────── */

/**
 * Metadata that can be attached to any annotation
 * Includes notes, visual styling, and organization
 */
export const AnnotationMetadataSchema = z.object({
  title: z.string().optional(),
  kind: z.string().optional(), // Classification: equation, table, figure, definition, etc.
  notes: z.string().optional(), // Markdown supported (keep for backward compatibility)
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(), // Hex color
  tags: z.array(z.string()).optional(), // Simple tags (can expand to relations later)

  // NEW: Attached note Assets (markdown files, images, PDFs)
  // Array of Asset UUIDs that are attached to this annotation
  attachedAssets: z.array(z.string().uuid()).optional(),

  // NEW: Note organization groups (branches in tree view)
  noteGroups: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        description: z.string().optional(),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
        order: z.number().int().min(0),
        viewMode: z.enum(["detailed", "compact", "list"]).default("compact"),
        columns: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
        width: z.number().int().min(320).optional(), // Resizable width in pixels
      })
    )
    .optional(),
});

export type AnnotationMetadata = z.infer<typeof AnnotationMetadataSchema>;

/* ────────────────────── Full Annotation Schema ────────────────────── */

/**
 * Complete annotation stored in Dexie
 * ID is deterministic hash of (sha256 + page + coords + type)
 */
export const AnnotationSchema = z.object({
  // Identity
  id: z.string(), // Deterministic hash
  sha256: z.string().length(64), // PDF hash (join key to Asset)
  page: z.number().int().positive(), // 1-indexed page number

  // Type-specific data (discriminated union)
  data: AnnotationDataSchema,

  // Common metadata
  metadata: AnnotationMetadataSchema,

  // Timestamps
  createdAt: z.number(), // Unix timestamp (ms)
  updatedAt: z.number(), // Unix timestamp (ms)
});

export type Annotation = z.infer<typeof AnnotationSchema>;

/* ────────────────────── Input Schema (for creation) ────────────────────── */

/**
 * Input for creating a new annotation (ID and timestamps will be generated)
 */
export const CreateAnnotationInputSchema = AnnotationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateAnnotationInput = z.infer<typeof CreateAnnotationInputSchema>;

/**
 * Input for updating an annotation
 */
export const UpdateAnnotationInputSchema = AnnotationSchema.partial().extend({
  id: z.string(), // ID is required for updates
});

export type UpdateAnnotationInput = z.infer<typeof UpdateAnnotationInputSchema>;

/* ────────────────────── Query Helpers ────────────────────── */

/**
 * Filters for querying annotations
 */
export interface AnnotationFilters {
  sha256?: string;
  page?: number;
  type?: AnnotationType;
  tags?: string[];
  fromDate?: number; // Unix timestamp
  toDate?: number; // Unix timestamp
}

/* ────────────────────── Utility Types ────────────────────── */

/**
 * Type guard for rectangle annotation
 */
export function isRectangleAnnotation(
  ann: Annotation
): ann is Annotation & { data: RectangleAnnotationData } {
  return ann.data.type === "rectangle";
}

/**
 * Type guard for highlight annotation
 */
export function isHighlightAnnotation(
  ann: Annotation
): ann is Annotation & { data: HighlightAnnotationData } {
  return ann.data.type === "highlight";
}

/* ────────────────────── Default Values ────────────────────── */

export const DEFAULT_ANNOTATION_COLOR = "#fbbf24"; // Amber-400

export const ANNOTATION_COLORS = {
  amber: "#fbbf24",
  purple: "#a855f7",
  blue: "#3b82f6",
  green: "#10b981",
  red: "#ef4444",
  pink: "#ec4899",
} as const;
