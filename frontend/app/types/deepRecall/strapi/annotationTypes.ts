// src/types/annotationTypes.ts
import { StrapiResponse } from "../../strapiTypes";
import { DeckCardStrapi } from "./deckCardTypes";
import { AnnotationTag, AnnotationTagStrapi, deserializeAnnotationTag } from "./annotationTagTypes";
import { AnnotationGroup, AnnotationGroupStrapi, deserializeAnnotationGroup } from "./annotationGroupTypes";

export interface AnnotationStrapi extends StrapiResponse {
  mode: AnnotationMode;
  literatureId: string;
  pdfId: string;
  /** plain‑JS object stringified by Strapi component field `customMetadata` */
  customMetadata: string;
  /** many-to-many relations */
  annotation_tags?: {
    data?:      AnnotationTagStrapi[];
    connect?:   string[];
    disconnect?:string[];
    set?:       string[];
  };
  annotation_groups?: {
    data?:      AnnotationGroupStrapi[];
    connect?:   string[];
    disconnect?:string[];
    set?:       string[];
  };
  // One to One relation with deck_card
  deck_card?: DeckCardStrapi;
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
  | "Calculation"
  | "Other"
  | "Recipe";

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
  "Calculation",
  "Other",
  "Recipe",
];

export type AnnotationMode = "rectangle" | "text";

export const types: AnnotationMode[] = [
  "rectangle",
  "text",
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

// Data that is saved in the customMetadata field
export interface AnnotationCustomMetadata extends BaseCoords {
  title?: string;
  type: AnnotationMode;
  description?: string;
  textContent?: string;
  notes?: string;
  color?: string;
  solutions?: Solution[];
  extra?: {
    imageUrl?: string;
    imageFileId?: number;
    [key: string]: unknown;
  };
}

// Interface for the frontend.
export interface Annotation extends AnnotationCustomMetadata, StrapiResponse {
  mode: AnnotationMode;
  literatureId: string;
  pdfId: string;
  annotation_tags?: AnnotationTag[];
  annotation_groups?: AnnotationGroup[];
  deck_card?: DeckCardStrapi;
  // All other fields, like documentID, createdAt, updatedAt, etc. are inherited from StrapiResponse and AnnotationCustomMetadata
}

/* ──────────────────── Strapi (de)serialisation helpers ─────────────── */

export function deserializeAnnotation(response: AnnotationStrapi): Annotation {
  const raw = response.customMetadata ?? {};
  const meta = typeof raw === "string" ? (raw ? JSON.parse(raw) : {}) : raw;
  const extra = {
    ...(meta.extra ?? {}),
    ...(meta.imageUrl ? { imageUrl: meta.imageUrl } : {}),
    ...(meta.imageFileId ? { imageFileId: meta.imageFileId } : {}),
  };
  const annotationTags = response.annotation_tags?.data || [];
  const annotationGroups = response.annotation_groups?.data || [];

  const annotation: Annotation = {
    // From StrapiResponse
    documentId: response.documentId,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    // From AnnotationStrapi
    mode: response.mode,
    literatureId: response.literatureId,
    pdfId: response.pdfId,
    // From AnnotationCustomMetadata
    // (BaseCoords)
    page: meta.page,
    x: meta.x,
    y: meta.y,
    width: meta.width,
    height: meta.height,
    // (AnnotationCustomMetadata)
    title: meta.title,
    type: meta.type,
    description: meta.description,
    textContent: meta.textContent,
    notes: meta.notes,
    color: meta.color,
    solutions: meta.solutions ?? [],
    extra,
    // Relations from AnnotationStrapi
    annotation_tags: annotationTags.map((annotationTag) => ({
      ...deserializeAnnotationTag(annotationTag),
    })),
    annotation_groups: annotationGroups.map((annotationGroup) => ({
      ...deserializeAnnotationGroup(annotationGroup),
    })),
    deck_card: response.deck_card,
  };

  return {
    ...annotation,
  };
}

export function serializeAnnotation(ann: Annotation): AnnotationStrapi {
  const {
    mode,
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
    type,
    annotation_tags,
    annotation_groups,
    color,
    solutions,
    extra = {},
    deck_card,
  } = ann;

  // Build the metadata payload
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
    type,
  };

  if (color) {
    meta.color = color;
  }
  if (solutions) {
    meta.solutions = solutions;
  }

  // Prepare relations
  const tagsSet = (annotation_tags?.map((t) => t.documentId) ?? []).filter((id): id is string => id !== undefined);
  const groupsSet = (annotation_groups?.map((g) => g.documentId) ?? []).filter((id): id is string => id !== undefined);

  // Assemble the Strapi payload
  const payload: Partial<AnnotationStrapi> = {
    mode,
    literatureId,
    pdfId,
    customMetadata: JSON.stringify(meta),
    annotation_tags: { set: tagsSet },
    annotation_groups: { set: groupsSet },
  };

  // Include deck_card relation if present
  if (deck_card?.documentId) {
    payload.deck_card = { connect: deck_card.documentId } as any;
  }

  return payload as AnnotationStrapi;
}