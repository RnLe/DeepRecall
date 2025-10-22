/**
 * Zod schemas for annotations (local durable data)
 */

import { z } from "zod";

export const NormalizedRectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

export type NormalizedRect = z.infer<typeof NormalizedRectSchema>;

export const AnnotationSchema = z.object({
  id: z.string(), // deterministic hash
  sha256: z.string(), // document hash
  page: z.number().int().positive(),
  type: z.enum(["highlight", "rectangle", "note"]),
  rects: z.array(NormalizedRectSchema),
  text: z.string().optional(),
  note: z.string().optional(),
  tags: z.array(z.string()).default([]),
  created_ms: z.number(),
  updated_ms: z.number(),
});

export type Annotation = z.infer<typeof AnnotationSchema>;
