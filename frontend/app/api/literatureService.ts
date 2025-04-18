// literatureService.ts

import {
  Literature,
  LiteratureType,
  transformLiterature,
  LiteratureExtended,
} from "../types/literatureTypes";
import { VersionType } from "../types/versionTypes";

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
const BASE_URL = "http://localhost:1337/api/literatures";

/**
 * Fetches literature entries.
 * The function populates all nested relations (including authors, metadata, versions, etc.).
 *
 * @returns An array of extended Literature objects.
 */
export const fetchLiteratures = async (): Promise<LiteratureExtended[]> => {
  const params = new URLSearchParams();
  params.append("populate", "*");

  const response = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(
      `API Error: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }

  const json = await response.json();
  // Transform each entry using our transformer function.
  return json.data.map((lit: Literature) => transformLiterature(lit));
};

/**
 * Creates a new literature entry.
 *
 * @param literatureData An object of type Omit<Literature, "id"> containing the new literature's data.
 * @returns The created Literature entry.
 */
export const createLiterature = async (
  literatureData: Omit<Literature, "documentId">
): Promise<Literature> => {
  // Build the payload (using the new model: title, type, metadata, and versions)
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
    throw new Error(
      `API Error: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }

  const json = await response.json();
  return json.data;
};

/**
 * Updates an existing literature entry.
 *
 * @param id - The id of the literature entry to update.
 * @param literatureData - A partial Literature object (without id) with updated fields.
 * @returns The updated Literature entry.
 */
export const updateLiterature = async (
  id: string,
  literatureData: Partial<Literature>
): Promise<Literature> => {
  const payload = literatureData;

  const response = await fetch(`${BASE_URL}/${id}`, {
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
    throw new Error(
      `API Error: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }

  const json = await response.json();
  return json.data;
};

/**
 * Deletes an existing literature entry.
 */
export const deleteLiterature = async (id: string): Promise<void> => {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
  });
  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(
      `API Error: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }
};

/**
 * Fetches literature types.
 *
 * @returns An array of LiteratureType objects.
 */
export const fetchLiteratureTypes = async (): Promise<LiteratureType[]> => {
  const response = await fetch(
    "http://localhost:1337/api/literature-types?populate=*",
    {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    }
  );

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(
      `API Error: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }

  const json = await response.json();
  return json.data;
};

/**
 * Creates a new literature type.
 *
 * @param literatureTypeData - An object of type Omit<LiteratureType, "id"> with the new literature type's data.
 * @returns The created LiteratureType object.
 */
export const createLiteratureType = async (
  literatureTypeData: Omit<LiteratureType, "documentId">
): Promise<LiteratureType> => {
  const payload = literatureTypeData;

  const response = await fetch("http://localhost:1337/api/literature-types", {
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
    throw new Error(
      `API Error: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }

  const json = await response.json();
  return json.data; // Return json.data so that the caller gets an object of type LiteratureType.
};


/**
 * Updates an existing literature type.
 *
 * @param id - The id of the literature type to update.
 * @param literatureTypeData - A partial LiteratureType object with updated fields.
 * @returns The updated LiteratureType object.
 */
export const updateLiteratureType = async (
  id: string,
  literatureTypeData: Partial<LiteratureType>
): Promise<LiteratureType> => {
  const payload = literatureTypeData;

  const response = await fetch(
    `http://localhost:1337/api/literature-types/${id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({ data: payload }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(
      `API Error: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }

  const json = await response.json();
  return json.data;
};

/**
 * Fetch version types.
 */
export const fetchVersionTypes = async (): Promise<VersionType[]> => {
  const response = await fetch("http://localhost:1337/api/version-types?populate=*", {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });
  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(
      `API Error: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }
  const json = await response.json();
  return json.data;
};

/**
 * Creates a new version type.
 */
export const createVersionType = async (
  versionTypeData: Omit<VersionType, "documentId">
): Promise<VersionType> => {
  const response = await fetch("http://localhost:1337/api/version-types", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({ data: versionTypeData }),
  });
  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(
      `API Error: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }
  const json = await response.json();
  return json.data;
};

/**
 * Updates an existing version type.
 */
export const updateVersionType = async (
  id: string,
  versionTypeData: Partial<VersionType>
): Promise<VersionType> => {
  const response = await fetch(`http://localhost:1337/api/version-types/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({ data: versionTypeData }),
  });
  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(
      `API Error: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }
  const json = await response.json();
  return json.data;
};

/**
 * Deletes an existing version type.
 */
export const deleteVersionType = async (id: string): Promise<void> => {
  const response = await fetch(`http://localhost:1337/api/version-types/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
  });
  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(
      `API Error: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }
};
