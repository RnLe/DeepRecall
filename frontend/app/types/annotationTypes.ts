// src/types/annotationTypes.ts
import { StrapiResponse } from "./strapiTypes";

/**
 * All supported annotation‑types (was “AnnotationKind”).
 */
export type AnnotationType =
  | "Equation"
  | "Plot"
  | "Illustration"
  | "Theorem"
  | "Statement"
  | "Definition"
  | "Figure"
  | "Table"
  | "Exercise"
  | "Problem";

interface BaseCoords {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Core fields for every annotation.
 * - tags, color, solutions remain; selectedColor is removed.
 */
export interface BaseAnnotation extends BaseCoords {
  documentId?: string;
  literatureId: string;
  pdfId: string;
  title?: string;
  description?: string;
  tags?: string[];
  color?: string;
  solutions?: Solution[];
  createdAt?: string;
  updatedAt?: string;
  extra?: {
    imageUrl?: string;
    imageFileId?: number;
    [key: string]: unknown;
  };
}

export interface RectangleAnnotation extends BaseAnnotation {
  type: "rectangle";
  annotationType: AnnotationType;
}

export interface TextAnnotation extends BaseAnnotation {
  type: "text";
  highlightedText: string;
}

export type Annotation = RectangleAnnotation | TextAnnotation;

/**
 * Serialized shape in Strapi.
 */
export interface AnnotationStrapi extends StrapiResponse {
  type: Annotation["type"];
  literatureId: string;
  pdfId: string;
  metadata: string;
}

/** Deserialize from Strapi into our model. */
export function deserializeAnnotation(rec: AnnotationStrapi): Annotation {
  const raw = rec.metadata ?? {};
  const meta =
    typeof raw === "string"
      ? raw
        ? JSON.parse(raw)
        : {}
      : raw;

  // Gather extra (including imageUrl/fileId)
  const extra = {
    ...(meta.extra ?? {}),
    ...(meta.imageUrl ? { imageUrl: meta.imageUrl } : {}),
    ...(meta.imageFileId ? { imageFileId: meta.imageFileId } : {}),
  };

  const common = {
    documentId: rec.documentId,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    page: meta.page,
    x: meta.x,
    y: meta.y,
    width: meta.width,
    height: meta.height,
    literatureId: String(rec.literatureId ?? meta.literatureId),
    pdfId: rec.pdfId ?? meta.pdfId,
    title: meta.title,
    description: meta.description,
    tags: meta.tags ?? [],
    color: meta.color,
    solutions: meta.solutions ?? [],
    extra,
  } as const;

  if (rec.type === "text") {
    return {
      ...common,
      type: "text",
      highlightedText: meta.highlightedText ?? "",
    };
  } else {
    return {
      ...common,
      type: "rectangle",
      annotationType: meta.annotationType as AnnotationType,
    };
  }
}

/** Serialize our model → Strapi payload. */
export function serializeAnnotation(ann: Annotation): AnnotationStrapi {
  const {
    type,
    literatureId,
    pdfId,
    page,
    x,
    y,
    width,
    height,
    title,
    description,
    tags,
    color,
    solutions,
    extra = {},
  } = ann;

  const meta: Record<string, unknown> = {
    page,
    x,
    y,
    width,
    height,
    title,
    description,
    ...extra,
  };

  if (tags) meta.tags = tags;
  if (color) meta.color = color;
  if (solutions) meta.solutions = solutions;

  if (type === "text") {
    meta.highlightedText = (ann as TextAnnotation).highlightedText;
  } else {
    meta.annotationType = (ann as RectangleAnnotation).annotationType;
  }

  return {
    type,
    literatureId,
    pdfId,
    metadata: JSON.stringify(meta),
  } as unknown as AnnotationStrapi;
}

/** Solution file metadata. */
export interface Solution {
  fileUrl: string;
  fileId: number;
  date: string;
  notes: string;
}
