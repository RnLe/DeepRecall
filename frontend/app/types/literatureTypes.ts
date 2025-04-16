// literatureTypes.ts

import { StrapiResponse } from "./strapiTypes";

/**
 * Recommended literature fields that you know how to handle.
 */
export interface RecommendedLiteratureFields {
  subtitle?: string;
  publisher?: string;
  authors?: string[];  // Array of authors
  journal?: string;
  doi?: string;
  // Boolean: if true, all versions are considered equal (e.g. exercise sheets);
  // if false, one version is primary (e.g. latest textbook edition)
  versionsAreEqual?: boolean;
}

/**
 * A dynamic metadata object that contains any arbitrary key-value pairs.
 */
export type DynamicMetadata = { [key: string]: any };

/**
 * Interface for a version.
 * Represents a PDF file upload with associated version metadata.
 */
export interface LiteratureVersion extends StrapiResponse {
  fileUrl: string;      // URL (or reference) to the uploaded PDF file
  thumbnailUrl: string; // URL to the thumbnail image
  metadata: string;     // JSON string with additional version metadata
}

/**
 * Recommended fields for a version.
 */
export interface RecommendedVersionFields {
  publishingDate?: string;  // Publishing date (or edition date)
  versionTitle?: string;     // A title for this version (e.g. "Second Edition")
  // For edition and verion, only one of them is used. This is enforced in the creation form and serves display purposes only.
  editionNumber?: number;     // Edition number (if applicable)
  versionNumber?: number;     // Version number (if applicable)
}

/**
 * Extended version interface with parsed metadata.
 */
export interface LiteratureVersionExtended extends LiteratureVersion, RecommendedVersionFields {
  customMetadata: DynamicMetadata;
}

/**
 * Literature item as stored in the database.
 * The metadata field is stored as a JSON string.
 */
export interface Literature extends StrapiResponse {
  title: string;
  type: string;       // Should match a literature type name.
  metadata: string;   // JSON string that will be parsed.
  versions?: LiteratureVersion[];  // Optional array of version objects
}

/**
 * Extended literature item with parsed metadata.
 * Recommended fields are directly available, and any additional 
 * custom fields are grouped under customMetadata.
 */
export interface LiteratureExtended extends Literature, RecommendedLiteratureFields {
  customMetadata: DynamicMetadata;
  versions: LiteratureVersionExtended[];
}

/**
 * Literature type that defines a set of recommended metadata fields,
 * stored as a JSON string. This type can be used to drive dynamic forms.
 */
export interface LiteratureType extends StrapiResponse {
  name: string;
  typeMetadata: string;  // JSON string defining recommended structure (e.g. field labels, types, etc.)
}

/**
 * Transforms a LiteratureVersion object by parsing its metadata JSON string,
 * extracting recommended fields, and grouping any extra values into customMetadata.
 */
export const transformLiteratureVersion = (version: LiteratureVersion): LiteratureVersionExtended => {
  let metadataObj: DynamicMetadata = {};
  if (version.metadata) {
    if (typeof version.metadata === 'string') {
      try {
        metadataObj = JSON.parse(version.metadata);
      } catch (error) {
        console.error(
          `Failed to parse metadata for literature version "${version.documentId || 'undefined'}":`,
          error
        );
      }
    } else if (typeof version.metadata === 'object' && version.metadata !== null) {
      metadataObj = version.metadata;
    }
  }
  
  // Extract recommended fields for versions
  const { publishingDate, versionTitle, editionNumber, versionNumber, ...customMetadata } = metadataObj;
  return {
    ...version,
    publishingDate,
    versionTitle,
    editionNumber,
    versionNumber,
    customMetadata,
  };
};

/**
 * Transforms a Literature object by parsing its metadata JSON string,
 * extracting recommended fields, and separating custom fields.
 * Also transforms nested versions if present.
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

  // Extract recommended literature fields.
  const { subtitle, publisher, authors, journal, doi, versionsAreEqual, ...customMetadata } = metadataObj;

  // Transform versions if they exist; otherwise, use an empty array.
  const transformedVersions: LiteratureVersionExtended[] = Array.isArray(lit.versions)
    ? lit.versions.map(transformLiteratureVersion)
    : [];

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
