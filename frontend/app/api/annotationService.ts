// src/api/annotationService.ts
/**
 * CRUD around the Strapi “annotations” collection.
 * Always (de)serialises via our updated helpers.
 */

import {
  Annotation,
  deserializeAnnotation,
  serializeAnnotation,
} from "../types/deepRecall/strapi/annotationTypes";

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
const BASE_URL = "http://localhost:1337/api/annotations";

const jsonHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_TOKEN}`,
};

function unwrapStrapi<T>(data: any): T {
  const { id, attributes } = data;
  return {
    documentId: id.toString(),
    ...attributes,
  } as T;
}

export async function fetchAnnotations(
  literatureId?: string,
  pdfId?: string
): Promise<Annotation[]> {
  const params = new URLSearchParams();

  if (literatureId !== undefined)
    params.append("filters[literatureId][$eq]", literatureId);
  if (pdfId !== undefined)
    params.append("filters[pdfId][$eq]", pdfId);

  params.append("pagination[pageSize]", "1000");
  params.append("sort", "createdAt:asc");

  // Include related annotation_tags in the response
  params.append("populate[0]", "annotation_tags");
  params.append("populate[1]", "annotation_groups");


  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: jsonHeaders,
  });

  if (!res.ok) throw new Error(`Fetch annotations failed: ${res.status}`);

  const json = await res.json();

  return json.data.map((d: any) => deserializeAnnotation(d));
}


export async function createAnnotation(
  ann: Annotation
): Promise<Annotation> {
  // 1) Build the base payload (with your "set" logic inside serializeAnnotation)
  const data = serializeAnnotation(ann);

  // 2) Override for create: only include connect if there are any tags
  const tagIds = (ann.annotation_tags?.map((t) => t.documentId).filter((t): t is string => !!t)) ?? [];
  if (tagIds.length > 0) {
    data.annotation_tags = { connect: tagIds };
  } else {
    delete data.annotation_tags;
  }

  // same for groups
  const groupIds = ann.annotation_groups?.map((g) => g.documentId).filter((id): id is string => Boolean(id)) ?? [];
  if (groupIds.length > 0) {
    data.annotation_groups = { connect: groupIds };
  } else {
    delete data.annotation_groups;
  }

  const payload = { data };

  // 3) Fire off the POST
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(
      `Create annotation failed: ${res.status} – ${JSON.stringify(err)}`
    );
  }
  const json = await res.json();
  return deserializeAnnotation(unwrapStrapi(json.data));
}

export async function updateAnnotation(
  id: string,
  ann: Annotation
): Promise<Annotation> {
  const payload = { data: serializeAnnotation(ann) };
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(
      `Update annotation failed: ${res.status} – ${JSON.stringify(err)}`
    );
  }
  const json = await res.json();
  return deserializeAnnotation(unwrapStrapi(json.data));
}

export async function deleteAnnotation(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "DELETE",
    headers: jsonHeaders,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(
      `Delete annotation failed: ${res.status} – ${JSON.stringify(err)}`
    );
  }
}
