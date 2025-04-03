// literatureService.ts

import { Literature, LiteratureType, MediaFile } from "../helpers/literatureTypes";

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
const BASE_URL = "http://localhost:1337/api/literatures";

/**
 * Fetches literature entries. Optionally, a type filter can be applied.
 * The function populates all nested relations (including authors, metadata, etc.).
 *
 * @param type Optional LiteratureType to filter the results.
 * @returns An array of Literature objects.
 */
export const fetchLiteratures = async (type?: LiteratureType): Promise<Literature[]> => {
  const params = new URLSearchParams();
  if (type) {
    params.append('filters[type][$eq]', type);
  }
  // Use a wildcard populate to load all relations.
  params.append('populate', '*');

  const response = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorBody)}`);
  }

  // In Strapi 5, nested relations are returned directly.
  const json = await response.json();
  return json.data;
};

/**
 * Creates a new literature entry.
 * This function accepts a Literature object (without an id) and converts any MediaFile
 * references in files to their corresponding ids before sending the payload.
 *
 * @param literatureData The literature data to create.
 * @returns The created Literature entry.
 */
export const createLiterature = async (
  literatureData: Omit<Literature, "id">
): Promise<Literature> => {
  const payload = literatureData;
  
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({ data: payload }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorBody)}`);
  }

  const json = await response.json();
  return json;
};

/**
 * Updates an existing literature entry.
 * @param documentId - The id of the literature entry to update.
 * @param literatureData - A partial Literature object (without id) containing updated fields.
 * @returns The updated Literature entry.
 */
export const updateLiterature = async (
  documentId: string,
    literatureData: Partial<Literature>
  ): Promise<Literature> => {
    const payload = literatureData;
  
    const response = await fetch(`${BASE_URL}/${documentId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({ data: payload }),
    });
  
    if (!response.ok) {
      const errorBody = await response.json();
      console.error("API Error", response.status, errorBody);
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorBody)}`);
    }
  
    const json = await response.json();
    return json;
  };