// src/api/annotationService.ts

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

export async function fetchAnnotations(
  literatureId?: string,
  pdfId?: string
): Promise<Annotation[]> {
  // Fetches raw AnnotationStrapi responses and deserializes them
  // Takes in optional literatureId and pdfId to filter by
  const params = new URLSearchParams();

  if (literatureId !== undefined)
    params.append("filters[literatureId][$eq]", literatureId);
  if (pdfId !== undefined)
    params.append("filters[pdfId][$eq]", pdfId);

  // Pagination and sorting
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
  // Response is wrapped in a data object
  // Additionally, deserialize the AnnotationStrapi object into an Annotation (frontend type)
  return json.data.map((d: any) => deserializeAnnotation(d));
}


export async function createAnnotation(
  ann: Annotation
): Promise<Annotation> {
  // Annotation has to be wrapped in a data object
  const payload = { data: serializeAnnotation(ann) };

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
  // The response is a AnnotationStrapi object, so we need to unwrap it
  return deserializeAnnotation(json.data);
}

export async function updateAnnotation(
  documentId: string,
  ann: Annotation
): Promise<Annotation> {
  // Annotation has to be wrapped in a data object
  const payload = { data: serializeAnnotation(ann) };
  
  const res = await fetch(`${BASE_URL}/${documentId}`, {
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
  
  return deserializeAnnotation(json.data);
}

export async function deleteAnnotation(documentId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/${documentId}`, {
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
