// src/api/annotationTagService.ts
/**
 * Lightweight CRUD for the “annotation-tags” collection type.
 * Only name + id so the code is minimal.
 */

import { AnnotationTag } from "../types/deepRecall/strapi/annotationTypes";

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
const BASE = "http://localhost:1337/api/annotation-tags";
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_TOKEN}`,
};


/* ------------------------------------------------------------------ */
/* READ – with optional fuzzy search (“containsi”)                    */
/* ------------------------------------------------------------------ */
export async function fetchTags(search: string = ""): Promise<AnnotationTag[]> {
  const params = new URLSearchParams({ "pagination[pageSize]": "100" });
  if (search) params.append("filters[name][$containsi]", search);
  const res = await fetch(`${BASE}?${params}`, { headers });
  if (!res.ok) throw new Error("Failed to fetch tags");
  const json = await res.json();
  return json.data;
}

/* ------------------------------------------------------------------ */
/* CREATE – single tag (name must be unique)                          */
/* ------------------------------------------------------------------ */
export async function createTag(name: string): Promise<AnnotationTag> {
  const payload = { data: { name } };
  const res = await fetch(BASE, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`createTag failed: ${JSON.stringify(err)}`);
  }
  const json = await res.json();
  return json.data;
}

/* ------------------------------------------------------------------ */
/* UPDATE – single tag                                                */
/* ------------------------------------------------------------------ */
export async function updateTag(id: string, name: string): Promise<AnnotationTag> {
  const payload = { data: { name } };
  const res = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`updateTag failed: ${JSON.stringify(err)}`);
  }
  const json = await res.json();
  return json.data;
}

/* ------------------------------------------------------------------ */
/* DELETE – single tag                                                */
/* ------------------------------------------------------------------ */
export async function deleteTag(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error(`deleteTag failed: ${res.statusText}`);
}
