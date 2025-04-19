// annotationTypes.ts
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
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BaseAnnotation extends BaseCoords {
  documentId?: string;
  literatureId: string;
  pdfId: string;
  title?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  /**
   * May include:
   *  - imageUrl?: string
   *  - imageFileId?: number
   */
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

/* ------------------------------------------------------------------ */
/* ---------------------------  STRAPI  ----------------------------- */
/* ------------------------------------------------------------------ */

export interface AnnotationStrapi extends StrapiResponse {
  type: Annotation["type"];
  literatureId: string;
  pdfId: string;
  metadata: string;
}

/* ------------------------------------------------------------------ */
/* ---------------------  SERIALISE / DESERIALISE ------------------- */
/* ------------------------------------------------------------------ */

export function deserializeAnnotation(rec: AnnotationStrapi): Annotation {
  const raw = rec.metadata ?? {};
  const meta =
    typeof raw === "string"
      ? raw
        ? JSON.parse(raw)
        : {}
      : raw;

  // **Collect any imageUrl / imageFileId fields into extra**
  const extraFields: Record<string, unknown> = {
    ...(meta.extra ?? {}),
    // Pull these top‑level props into extra
    ...(meta.imageUrl !== undefined ? { imageUrl: meta.imageUrl } : {}),
    ...(meta.imageFileId !== undefined
      ? { imageFileId: meta.imageFileId }
      : {}),
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
    extra = {},
  } = ann;

  // We still flatten extra back into metadata JSON
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

  return {
    type,
    literatureId,
    pdfId,
    metadata: JSON.stringify(meta),
  } as unknown as AnnotationStrapi;
}
