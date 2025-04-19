// src/api/colorSchemeService.ts

import { ColorScheme } from "../types/colorSchemeTypes";

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
const BASE_URL = "http://localhost:1337/api/color-schemes";

const jsonHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_TOKEN}`,
};

/** Unwrap Strapi v5 record to our ColorScheme, using documentId */
function unwrapStrapi<T>(data: any): T {
  // support both Strapi v5 nested (data.attributes) and flat responses
  if (data.attributes) {
    const { attributes } = data;
    return { documentId: attributes.documentId, ...attributes } as T;
  }
  return data as T;
}

/** Fetch all schemes (up to 1000) */
export async function fetchColorSchemes(): Promise<ColorScheme[]> {
  const params = new URLSearchParams({
    "pagination[pageSize]": "1000",
    sort: "createdAt:asc",
  });
  const res = await fetch(`${BASE_URL}?${params}`, { headers: jsonHeaders });
  if (!res.ok) throw new Error(`Fetch schemes failed: ${res.status}`);
  const json = await res.json();
  console.log("Fetched schemes", json);
  return json.data.map((d: any) => unwrapStrapi<ColorScheme>(d));
}

/** Create a new scheme */
export async function createColorScheme(
  scheme: Omit<ColorScheme, "documentId" | "createdAt" | "updatedAt">
): Promise<ColorScheme> {
  const payload = { data: scheme };
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(
      `Create scheme failed: ${res.status} – ${JSON.stringify(err)}`
    );
  }
  const json = await res.json();
  return unwrapStrapi<ColorScheme>(json.data);
}

/** Update an existing scheme */
export async function updateColorScheme(
  documentId: string,
  scheme: Omit<ColorScheme, "documentId" | "createdAt" | "updatedAt">
): Promise<ColorScheme> {
  const payload = { data: scheme };
  const res = await fetch(`${BASE_URL}/${documentId}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(
      `Update scheme failed: ${res.status} – ${JSON.stringify(err)}`
    );
  }
  const json = await res.json();
  return unwrapStrapi<ColorScheme>(json.data);
}

/** Delete a scheme */
export async function deleteColorScheme(documentId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/${documentId}`, {
    method: "DELETE",
    headers: jsonHeaders,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(
      `Delete scheme failed: ${res.status} – ${JSON.stringify(err)}`
    );
  }
}
