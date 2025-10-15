// collectionService.ts

import {
  Collection,
  CollectionExtended,
  transformCollection,
  prepareCollectionForSave,
} from "../types/deepRecall/strapi/collectionTypes";

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
const BASE_URL = "http://localhost:1337/api/collections";

/**
 * Fetches collection entries.
 * The function populates all nested relations.
 *
 * @returns An array of extended Collection objects.
 */
export const fetchCollections = async (): Promise<CollectionExtended[]> => {
  const params = new URLSearchParams();
  params.append("populate", "*");
  // Set pagination to get all items (Strapi defaults to 25 items max)
  params.append("pagination[pageSize]", "1000"); // Set a high limit to get all items
  params.append("pagination[page]", "1");

  const response = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("Collections API Error", response.status, errorBody);
    throw new Error(
      `Collections API Error: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }

  const json = await response.json();
  // Transform each entry using our transformer function.
  const collections = json.data.map((collection: Collection) => transformCollection(collection));

  return collections;
};

/**
 * Creates a new collection entry.
 *
 * @param collectionData An object of type Omit<CollectionExtended, "documentId"> containing the new collection's data.
 * @returns The created Collection entry.
 */
export const createCollection = async (
  collectionData: Omit<CollectionExtended, "documentId" | "id" | "createdAt" | "updatedAt" | "publishedAt">
): Promise<Collection> => {
  // Prepare the data for saving (stringify metadata)
  const payload = prepareCollectionForSave(collectionData);

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
    console.error("Create Collection API Error", response.status, errorBody);
    throw new Error(
      `Create Collection API Error: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }

  const json = await response.json();
  return json.data;
};

/**
 * Updates an existing collection entry.
 *
 * @param id - The documentId of the collection entry to update.
 * @param collectionData - A partial CollectionExtended object with updated fields.
 * @returns The updated Collection entry.
 */
export const updateCollection = async (
  id: string,
  collectionData: Partial<CollectionExtended>
): Promise<Collection> => {
  // Prepare the data for saving (stringify metadata)
  const payload = prepareCollectionForSave(collectionData);

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
    console.error("Update Collection API Error", response.status, errorBody);
    throw new Error(
      `Update Collection API Error: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }

  const json = await response.json();
  return json.data;
};

/**
 * Deletes a collection entry.
 *
 * @param id - The documentId of the collection entry to delete.
 * @returns void
 */
export const deleteCollection = async (id: string): Promise<void> => {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("Delete Collection API Error", response.status, errorBody);
    throw new Error(
      `Delete Collection API Error: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }
};

/**
 * Adds a literature item to a collection.
 *
 * @param collectionId - The documentId of the collection.
 * @param literatureId - The documentId of the literature to add.
 * @returns The updated Collection entry.
 */
export const addLiteratureToCollection = async (
  collectionId: string,
  literatureId: string
): Promise<Collection> => {
  // First, fetch the current collection to get existing literature IDs
  const response = await fetch(`${BASE_URL}/${collectionId}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch collection: ${response.status}`);
  }

  const json = await response.json();
  const collection = transformCollection(json.data);

  // Add the literature ID if it's not already in the collection
  const currentLiteratureIds = collection.literatureIds || [];
  if (!currentLiteratureIds.includes(literatureId)) {
    const updatedLiteratureIds = [...currentLiteratureIds, literatureId];
    
    return updateCollection(collectionId, {
      literatureIds: updatedLiteratureIds
    });
  }

  // Return the collection unchanged if the literature is already in it
  return json.data;
};

/**
 * Removes a literature item from a collection.
 *
 * @param collectionId - The documentId of the collection.
 * @param literatureId - The documentId of the literature to remove.
 * @returns The updated Collection entry.
 */
export const removeLiteratureFromCollection = async (
  collectionId: string,
  literatureId: string
): Promise<Collection> => {
  // First, fetch the current collection to get existing literature IDs
  const response = await fetch(`${BASE_URL}/${collectionId}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch collection: ${response.status}`);
  }

  const json = await response.json();
  const collection = transformCollection(json.data);

  // Remove the literature ID if it exists in the collection
  const currentLiteratureIds = collection.literatureIds || [];
  const updatedLiteratureIds = currentLiteratureIds.filter(id => id !== literatureId);
  
  return updateCollection(collectionId, {
    literatureIds: updatedLiteratureIds
  });
};
