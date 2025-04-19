// src/types/annotationTypes.ts
import { StrapiResponse } from "./strapiTypes";

/**
 * A user‐uploaded solution file, with metadata for display & deletion.
 */
export interface Solution {
  fileUrl: string;
  fileId: number;
  date: string;  // ISO date string
  notes: string;
}

/**
 * All supported rectangle‑annotation “kinds,”
 * now including both Exercise & Problem.
 */
export type AnnotationKind =
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
 * Common fields for every annotation.
 * - tags, color, selectedColor, solutions are new.
 */
export interface BaseAnnotation extends BaseCoords {
  documentId?: string;
  literatureId: string;
  pdfId: string;
  title?: string;
  description?: string;
  tags?: string[];
  color?: string;
  selectedColor?: string;
  solutions?: Solution[];
  createdAt?: string;
  updatedAt?: string;
  extra?: Record<string, unknown> & {
    imageUrl?: string;
    imageFileId?: number;
  };
}

export interface RectangleAnnotation extends BaseAnnotation {
  type: "rectangle";
  annotationKind: AnnotationKind;
}

export interface TextAnnotation extends BaseAnnotation {
  type: "text";
  highlightedText: string;
}

export type Annotation = RectangleAnnotation | TextAnnotation;

/**
 * Strapi v5 response shape for annotations.
 */
export interface AnnotationStrapi extends StrapiResponse {
  type: Annotation["type"];
  literatureId: string;
  pdfId: string;
  metadata: string;
}

/**
 * Turn Strapi payload → our Annotation, extracting all new fields.
 */
export function deserializeAnnotation(rec: AnnotationStrapi): Annotation {
  const raw = rec.metadata ?? {};
  const meta =
    typeof raw === "string"
      ? raw
        ? JSON.parse(raw)
        : {}
      : raw;

  // Pull any imageUrl / imageFileId into extra
  const extraFields: Record<string, unknown> = {
    ...(meta.extra ?? {}),
    ...(meta.imageUrl !== undefined ? { imageUrl: meta.imageUrl } : {}),
    ...(meta.imageFileId !== undefined
      ? { imageFileId: meta.imageFileId }
      : {}),
  };

  // Extract our new fields
  const tags: string[] = meta.tags ?? [];
  const color: string | undefined = meta.color;
  const selectedColor: string | undefined = meta.selectedColor;
  const solutions: Solution[] = (meta.solutions ?? []).map((s: any) => ({
    fileUrl: s.fileUrl,
    fileId: s.fileId,
    date: s.date,
    notes: s.notes,
  }));

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
    tags,
    color,
    selectedColor,
    solutions,
    extra: extraFields,
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
      annotationKind: meta.annotationKind as AnnotationKind,
    };
  }
}

/**
 * Turn our Annotation → Strapi payload, serializing all new fields.
 */
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
    selectedColor,
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
  if (selectedColor) meta.selectedColor = selectedColor;
  if (solutions) {
    meta.solutions = solutions.map((s) => ({
      fileUrl: s.fileUrl,
      fileId: s.fileId,
      date: s.date,
      notes: s.notes,
    }));
  }

  if (type === "text") {
    meta.highlightedText = (ann as TextAnnotation).highlightedText;
  } else {
    meta.annotationKind = (ann as RectangleAnnotation).annotationKind;
  }

  return {
    type,
    literatureId,
    pdfId,
    metadata: JSON.stringify(meta),
  } as unknown as AnnotationStrapi;
}
