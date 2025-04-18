/**
 * Central annotation model + helpers
 * ‑ Converts between the lean Strapi DB shape
 *   { type, literatureId, pdfId, metadata: string }
 *   and the rich union used in the frontend.
 */

import { StrapiResponse } from "./strapiTypes";

/* ------------------------------------------------------------------ */
/* --------------------------  FRONTEND ----------------------------- */
/* ------------------------------------------------------------------ */

export type AnnotationKind =
  | "Equation"
  | "Plot"
  | "Illustration"
  | "Theorem"
  | "Statement"
  | "Definition"
  | "Figure"
  | "Table";

interface BaseCoords {
  page: number;          // 1‑based page index
  x: number;             // normalised 0‑1
  y: number;             // normalised 0‑1
  width: number;         // normalised 0‑1
  height: number;        // normalised 0‑1
}

export interface BaseAnnotation extends BaseCoords {
  /** Undefined until the record is persisted */
  documentId?: string;
  /** FK to the literature entity (Strapi's ID) */
  literatureId: string;
  /** Hash of the PDF file that the annotation belongs to */
  pdfId: string;
  title?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Arbitrary, type‑specific extra data */
  extra?: Record<string, unknown>;
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

/* ------------------------------------------------------------------ */
/* ---------------------------  STRAPI  ----------------------------- */
/* ------------------------------------------------------------------ */

export interface AnnotationStrapi extends StrapiResponse {
  type: Annotation["type"];
  /** New top‑level columns for fast querying */
  literatureId: string;
  pdfId: string;
  /** JSON string holding the geometry & misc. info */
  metadata: string;
}

/* ------------------------------------------------------------------ */
/* ---------------------  SERIALISE / DESERIALISE ------------------- */
/* ------------------------------------------------------------------ */

/**
 * Convert Strapi record → rich frontend object
 */
export function deserializeAnnotation(rec: AnnotationStrapi): Annotation {
  // tolerate missing or null metadata coming from Strapi
  const raw = rec.metadata ?? {};
  const meta =
    typeof raw === "string"
      ? (raw ? JSON.parse(raw) : {})   // empty string → {}
      : raw;

  const common = {
    documentId: rec.documentId,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    /** geometry */
    page: meta.page,
    x: meta.x,
    y: meta.y,
    width: meta.width,
    height: meta.height,
    /** foreign keys – take from top level, fall back to old metadata */
    literatureId: String(rec.literatureId ?? meta.literatureId),
    pdfId:         rec.pdfId         ?? meta.pdfId,
    /** misc. */
    title: meta.title,
    description: meta.description,
    extra: meta.extra ?? {},
  } as const;

  if (rec.type === "text") {
    return {
      ...common,
      type: "text",
      highlightedText: meta.highlightedText ?? "",
    };
  }

  return {
    ...common,
    type: "rectangle",
    annotationKind: meta.annotationKind as AnnotationKind,
  };
}

/**
 * Convert rich frontend object → payload for Strapi
 */
/* ------------------------------------------------------------------ */
/* ---------------------  SERIALISE / DESERIALISE ------------------- */
/* ------------------------------------------------------------------ */

export function serializeAnnotation(ann: Annotation): AnnotationStrapi {
  const {
    /* NEVER send these → Strapi would reject them */
    /* documentId, createdAt, updatedAt, */
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

  if (type === "text") {
    meta.highlightedText = (ann as TextAnnotation).highlightedText;
  } else {
    meta.annotationKind = (ann as RectangleAnnotation).annotationKind;
  }

  /* ONLY the fields declared in the Strapi content‑type */
  return {
    type,
    literatureId,
    pdfId,
    metadata: JSON.stringify(meta),
  } as unknown as AnnotationStrapi;
}

/* ------------------------------------------------------------------ */
/* -------- Legacy aliases (for existing components) ---------------- */
/* ------------------------------------------------------------------ */
export const transformAnnotation = deserializeAnnotation;
export const wrapAnnotationForSave = serializeAnnotation;
