/**
 * Board schema for note-taking canvas
 * Represents a whiteboard/canvas for drawing and note-taking
 */

import { z } from "zod";
import { Id, ISODate } from "./library";

/**
 * Board - A canvas for drawing and notes
 */
export const BoardSchema = z.object({
  id: Id,
  kind: z.literal("board"),

  // Core identity
  title: z.string(),
  description: z.string().optional(),

  // UI metadata
  icon: z.string().optional(),
  color: z.string().optional(),

  // Canvas properties
  width: z.number().default(10000), // World units
  height: z.number().default(10000),
  backgroundColor: z.string().default("#ffffff"),

  // Timestamps
  createdAt: ISODate,
  updatedAt: ISODate,
});

export type Board = z.infer<typeof BoardSchema>;

/**
 * Point in a stroke with pressure and tilt data
 */
export const StrokePointSchema = z.object({
  x: z.number(),
  y: z.number(),
  pressure: z.number().min(0).max(1).default(0.5),
  timestamp: z.number(), // Relative milliseconds from stroke start
  tiltX: z.number().optional(), // For stylus support
  tiltY: z.number().optional(),
});

export type StrokePoint = z.infer<typeof StrokePointSchema>;

/**
 * Stroke style properties
 */
export const StrokeStyleSchema = z.object({
  color: z.string().default("#000000"),
  width: z.number().min(0.5).max(100).default(2),
  opacity: z.number().min(0).max(1).default(1),
  brushType: z.enum(["pen", "highlighter", "marker"]).default("pen"),
});

export type StrokeStyle = z.infer<typeof StrokeStyleSchema>;

/**
 * Stroke - A single pen/brush stroke on the canvas
 */
export const StrokeSchema = z.object({
  id: Id,
  kind: z.literal("stroke"),

  // Board reference
  boardId: Id,

  // Points data (stored as JSON in Postgres, parsed in memory)
  points: z.array(StrokePointSchema),

  // Style
  style: StrokeStyleSchema,

  // Bounding box for spatial queries
  boundingBox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),

  // Timestamps
  createdAt: ISODate,
  updatedAt: ISODate,
});

export type Stroke = z.infer<typeof StrokeSchema>;
