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
 * Shape metadata for geometric strokes
 */
export const ShapeMetadataSchema = z.object({
  shapeType: z.enum(["line", "circle", "ellipse", "rectangle", "square"]),
  descriptor: z.record(z.string(), z.any()), // Serialized shape descriptor
  hasFill: z.boolean().default(true),
  fillOpacity: z.number().min(0).max(1).default(0.15),
});

export type ShapeMetadata = z.infer<typeof ShapeMetadataSchema>;

/**
 * Stroke style properties
 */
export const StrokeStyleSchema = z.object({
  color: z.string().default("#000000"),
  width: z.number().min(0.5).max(100).default(2),
  opacity: z.number().min(0).max(1).default(1),
  // Tool identifier (pen, highlighter, marker, pencil, etc.)
  toolId: z.string().default("pen"),
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

  // Shape metadata (optional, for geometric strokes)
  shapeMetadata: ShapeMetadataSchema.optional(),
});

export type Stroke = z.infer<typeof StrokeSchema>;
