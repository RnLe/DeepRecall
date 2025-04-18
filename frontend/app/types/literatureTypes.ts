// literatureTypes.ts

import { StrapiResponse } from "./strapiTypes";
// Import new version types & transformer.
import { VersionExtended, transformVersion } from "./versionTypes";

/**
 * Supported literature fields (formerly "Recommended")
 */
export interface SupportedLiteratureFields {
  subtitle?: string;
  publisher?: string;
  authors?: string[];
  journal?: string;
  doi?: string;
  versionsAreEqual?: boolean;
}

/**
 * A dynamic metadata object that contains any arbitrary key-value pairs.
 */
export type DynamicMetadata = { [key: string]: any };

/**
 * Literature version as stored in Strapi.
 * (Version related types have been refactored into versionTypes.ts)
 */

/**
 * Literature (entity) stored in the database.
 */
export interface Literature extends StrapiResponse {
  title: string;
  type: string;
  metadata: string;
}

/**
 * Extended literature with parsed metadata and flattened versions.
 */
export interface LiteratureExtended extends Literature, SupportedLiteratureFields {
  customMetadata: DynamicMetadata;
  versions: VersionExtended[];
}

/**
 * Literature type defines the structure of a literature as stored in the database.
 */
export interface LiteratureType extends StrapiResponse {
  name: string;
  typeMetadata: string;
}

/**
 * Transforms a Literature object by parsing its metadata JSON string,
 * extracting supported fields, and separating custom fields.
 */
export const transformLiterature = (lit: Literature): LiteratureExtended => {
  let metadataObj: DynamicMetadata = {};

  // Check if metadata exists and whether it is a string or already an object.
  if (lit.metadata) {
    if (typeof lit.metadata === 'string') {
      try {
        metadataObj = JSON.parse(lit.metadata);
      } catch (error) {
        console.error(
          `Failed to parse metadata for literature "${lit.title || 'undefined'}":`,
          error
        );
      }
    } else if (typeof lit.metadata === 'object' && lit.metadata !== null) {
      metadataObj = lit.metadata;
    }
  }

  // Extract supported literature fields.
  const { subtitle, publisher, authors, journal, doi, versionsAreEqual, ...customMetadata } = metadataObj;

  // Transform versions stored in metadata.
  const rawVersions = Array.isArray(metadataObj.versions) ? metadataObj.versions : [];
  const transformedVersions = rawVersions.map(transformVersion);

  return {
    ...lit,
    subtitle,
    publisher,
    authors,
    journal,
    doi,
    versionsAreEqual,
    customMetadata,
    versions: transformedVersions,
  };
};
