// src/types/annotationTypes.ts
import { StrapiResponse } from "./strapiTypes";

/* ──────────────────── NEW relational helper types ──────────────────── */

export interface AnnotationTag extends StrapiResponse {
  /** uniqueness is enforced in Strapi */
  name: string;
}

export interface AnnotationGroup extends StrapiResponse {
  /** will get more fields later */
  name: string;
}

/* ────────────────── Annotation‑specific value enums ────────────────── */

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
  | "Abstract"
  | "Problem"
  | "Calculation"     // ← NEW
  | "Other";          // ← NEW

export const annotationTypes: AnnotationType[] = [
  "Equation",
  "Plot",
  "Illustration",
  "Theorem",
  "Statement",
  "Definition",
  "Figure",
  "Table",
  "Exercise",
  "Problem",
  "Abstract",
  "Calculation",      // ← NEW
  "Other",            // ← NEW
];

/* ────────────────────── Core model definitions ─────────────────────── */

interface BaseCoords {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Solution {
  fileUrl: string;
  fileId: number;
  date: string;
  notes: string;
}

/**
 * Core for every annotation.
 * Relations (`tags`, `groups`) come straight from Strapi.
 */
export interface BaseAnnotation extends BaseCoords {
  documentId?: string;
  literatureId: string;
  pdfId: string;
  title?: string;
  description?: string;
  notes?: string;
  /** Strapi M‑to‑M relation (empty array = none) */
  annotation_tags?: AnnotationTag[];
  /** reserved for later */
  annotation_groups?: AnnotationGroup[];
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

/* ───────────────────── Concrete annotation variants ────────────────── */

export interface RectangleAnnotation extends BaseAnnotation {
  type: "rectangle";
  annotationType: AnnotationType;
}
export interface TextAnnotation extends BaseAnnotation {
  type: "text";
  highlightedText: string;
}
export type Annotation = RectangleAnnotation | TextAnnotation;

/* ──────────────────── Strapi (de)serialisation helpers ─────────────── */

export interface AnnotationStrapi extends StrapiResponse {
  type: Annotation["type"];
  literatureId: string;
  pdfId: string;
  /** plain‑JS object stringified by Strapi component field `metadata` */
  metadata: string;
  /** many-to-many relations */
  annotation_tags?: {
    data?:      AnnotationTag[];      // for responses
    connect?:   string[];             // for POST/PUT
    disconnect?:string[];
    set?:       string[];
  };
  annotation_groups?: {
    data?:      AnnotationGroup[];
    connect?:   string[];
    disconnect?:string[];
    set?:       string[];
  };
}

/** helper: accept either `T[]` or `{ data?: T[] }` */
const mapTags = <T>(rel?: T[] | { data?: T[] }): T[] =>
  Array.isArray(rel)
    ? rel
    : rel?.data
    ? rel.data
    : [];

export function deserializeAnnotation(rec: AnnotationStrapi): Annotation {
  const raw = rec.metadata ?? {};
  const meta =
    typeof raw === "string" ? (raw ? JSON.parse(raw) : {}) : raw;

  const extra = {
    ...(meta.extra ?? {}),
    ...(meta.imageUrl ? { imageUrl: meta.imageUrl } : {}),
    ...(meta.imageFileId ? { imageFileId: meta.imageFileId } : {}),
  };

  const common: Omit<BaseAnnotation, keyof BaseCoords> & BaseCoords = {
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
    notes: meta.notes,                // ← NEW
    /* relations */
    annotation_tags: mapTags<AnnotationTag>(rec.annotation_tags),
    annotation_groups: mapTags<AnnotationGroup>(rec.annotation_groups),
    color: meta.color,
    solutions: meta.solutions ?? [],
    extra,
  } as const;

  return rec.type === "text"
    ? {
        ...common,
        type: "text",
        highlightedText: meta.highlightedText ?? "",
      }
    : {
        ...common,
        type: "rectangle",
        annotationType: meta.annotationType as AnnotationType,
      };
}

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
    notes,
    annotation_tags,
    annotation_groups,
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
    notes,
    ...extra,
  };
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
    /**
     * Strapi‑v5: use `set` to replace all relations in one go.
     * This ensures removing a tag in the UI will
     * actually disconnect it on save.
     */
    annotation_tags:    { set: annotation_tags?.map((t) => t.documentId) },
    annotation_groups:  { set: (ann.annotation_groups ?? []).map((g) => g.documentId) },
  } as unknown as AnnotationStrapi;
}
