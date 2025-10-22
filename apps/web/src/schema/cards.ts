/**
 * Zod schemas for SRS cards (local durable data)
 */

import { z } from "zod";

export const CardSchema = z.object({
  id: z.string(), // deterministic hash
  annotation_id: z.string(),
  sha256: z.string(), // document hash
  type: z.enum(["cloze", "concept", "step", "unit", "figure"]),
  front: z.string(),
  back: z.string(),
  // FSRS state
  due: z.number(),
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  reps: z.number(),
  lapses: z.number(),
  state: z.enum(["New", "Learning", "Review", "Relearning"]),
  last_review: z.number().optional(),
  created_ms: z.number(),
  updated_ms: z.number(),
});

export type Card = z.infer<typeof CardSchema>;

export const ReviewLogSchema = z.object({
  id: z.string(),
  card_id: z.string(),
  rating: z.number().int().min(1).max(4),
  review_ms: z.number(),
  latency_ms: z.number().optional(),
});

export type ReviewLog = z.infer<typeof ReviewLogSchema>;
