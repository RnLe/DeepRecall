// src/api/annotationGroupService.ts
/**
 * CRUD for collection type “annotation-groups”.
 * Model is currently just { id, name } – kept for future use.
 */

import { AnnotationGroup } from "../types/annotationTypes";

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
const BASE = "http://localhost:1337/api/annotation-groups";
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_TOKEN}`,
};


/* ---------------------------- READ ---------------------------- */
export async function fetchGroups(): Promise<AnnotationGroup[]> {
  const res = await fetch(`${BASE}?pagination[pageSize]=100`, { headers });
  if (!res.ok) throw new Error("Failed to fetch groups");
  const json = await res.json();
  return json.data;
}

/* --------------------------- CREATE --------------------------- */
export async function createGroup(name: string): Promise<AnnotationGroup> {
  const res = await fetch(BASE, {
    method: "POST",
    headers,
    body: JSON.stringify({ data: { name } }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`createGroup failed: ${JSON.stringify(err)}`);
  }
  const json = await res.json();
  return json.data;
}

/* --------------------------- UPDATE --------------------------- */
export async function updateGroup(id: string, name: string): Promise<AnnotationGroup> {
  const payload = { data: { name } };
  const res = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`updateGroup failed: ${JSON.stringify(err)}`);
  }
  const json = await res.json();
  return json.data;
}

/* --------------------------- DELETE --------------------------- */
export async function deleteGroup(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error(`deleteGroup failed: ${res.statusText}`);
}
