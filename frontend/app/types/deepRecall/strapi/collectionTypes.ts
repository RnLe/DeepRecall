// collectionTypes.ts

import { StrapiResponse } from "../../strapiTypes";

/**
 * Supported collection fields (formerly "Recommended")
 */
export interface SupportedCollectionFields {
  description?: string;
  color?: string; // Hex color for UI theming
  icon?: string; // Lucide icon name for the collection
  literatureIds?: string[]; // Array of literature document IDs in this collection
  isPrivate?: boolean; // Whether the collection is private or shared
  tags?: string[]; // Tags for organizing collections
  createdBy?: string; // User ID who created the collection
}

/**
 * A dynamic metadata object that contains any arbitrary key-value pairs.
 */
export type DynamicMetadata = { [key: string]: any };

/**
 * Collection (entity) stored in the database.
 */
export interface Collection extends StrapiResponse {
  title: string;
  metadata: string;
}

/**
 * Extended collection with parsed metadata and flattened fields.
 */
export interface CollectionExtended extends Collection, SupportedCollectionFields {
  customMetadata: DynamicMetadata;
}

/**
 * Utility functions for collection operations
 */

/**
 * Checks if a collection contains a specific literature item.
 */
export const collectionContainsLiterature = (collection: CollectionExtended, literatureId: string): boolean => {
  return collection.literatureIds ? collection.literatureIds.includes(literatureId) : false;
};

/**
 * Gets the count of literature items in a collection.
 */
export const getCollectionLiteratureCount = (collection: CollectionExtended): number => {
  return collection.literatureIds ? collection.literatureIds.length : 0;
};

/**
 * Gets a display color for a collection with fallback.
 */
export const getCollectionDisplayColor = (collection: CollectionExtended): string => {
  return collection.color || '#6366f1'; // Default to indigo-500
};

/**
 * Gets a display icon for a collection with fallback.
 */
export const getCollectionDisplayIcon = (collection: CollectionExtended): string => {
  return collection.icon || 'Folder'; // Default to Folder icon
};

/**
 * Transforms a Collection object by parsing its metadata JSON string,
 * extracting supported fields, and separating custom fields.
 */
export const transformCollection = (collection: Collection): CollectionExtended => {
  let metadataObj: DynamicMetadata = {};

  // Check if metadata exists and whether it is a string or already an object.
  if (collection.metadata) {
    if (typeof collection.metadata === 'string') {
      try {
        metadataObj = JSON.parse(collection.metadata);
      } catch (error) {
        console.error(
          `Failed to parse metadata for collection "${collection.title || 'undefined'}":`,
          error
        );
      }
    } else if (typeof collection.metadata === 'object' && collection.metadata !== null) {
      metadataObj = collection.metadata;
    }
  }

  // Extract supported collection fields.
  const { 
    description, 
    color, 
    icon, 
    literatureIds, 
    isPrivate, 
    tags, 
    createdBy, 
    ...customMetadata 
  } = metadataObj;

  return {
    ...collection,
    description,
    color,
    icon,
    literatureIds,
    isPrivate,
    tags,
    createdBy,
    customMetadata,
  };
};

/**
 * Prepares collection data for saving to the database by stringifying metadata.
 */
export const prepareCollectionForSave = (collection: Partial<CollectionExtended>): Partial<Collection> => {
  const { 
    description, 
    color, 
    icon, 
    literatureIds, 
    isPrivate, 
    tags, 
    createdBy, 
    customMetadata, 
    ...baseFields 
  } = collection;

  const metadata = {
    description,
    color,
    icon,
    literatureIds,
    isPrivate,
    tags,
    createdBy,
    ...customMetadata,
  };

  return {
    ...baseFields,
    metadata: JSON.stringify(metadata),
  };
};
