import { StrapiResponse } from "../../strapiTypes";

// If needed, re-declare DynamicMetadata (or import from literatureTypes to avoid circular deps)
export type DynamicMetadata = { [key: string]: any };

/**
 * Supported version fields (formerly "Recommended")
 */
export interface SupportedVersionFields {
  publishingDate?: string;
  versionTitle?: string;
  editionNumber?: number;
  versionNumber?: number;
  literatureTypes?: string[]; // Array of literature type names this version type supports
}

/**
 * Extended version with parsed metadata.
 */
export interface VersionExtended extends VersionType, SupportedVersionFields {
  fileUrl: string;
  thumbnailUrl: string;
  customMetadata: DynamicMetadata;
  fileHash: string;
  fileId?: number; // Strapi file ID for the PDF file
  thumbnailId?: number; // Strapi file ID for the thumbnail image
}

/**
 * VersionType as defined in the database.
 */
export interface VersionType extends StrapiResponse {
  name: string;
  versionMetadata: string;
}

/**
 * Transforms a Version object by parsing its metadata JSON string,
 * extracting supported fields, and grouping extra values into customMetadata.
 */
export const transformVersion = (version: VersionType): VersionExtended => {
  let metadataObj: DynamicMetadata = {};
  if (version.versionMetadata) {
    if (typeof version.versionMetadata === 'string') {
      try {
        metadataObj = JSON.parse(version.versionMetadata);
      } catch (error) {
        console.error(
          `Failed to parse metadata for version "${version.documentId || 'undefined'}":`,
          error
        );
      }
    } else if (typeof version.versionMetadata === 'object' && version.versionMetadata !== null) {
      metadataObj = version.versionMetadata;
    }
  }
  
  const { fileUrl, thumbnailUrl, publishingDate, versionTitle, editionNumber, versionNumber, fileHash, literatureTypes, fileId, thumbnailId, ...customMetadata } = metadataObj;
  return {
    ...version,
    fileUrl,
    thumbnailUrl,
    publishingDate,
    versionTitle,
    editionNumber,
    versionNumber,
    fileHash,
    literatureTypes,
    fileId,
    thumbnailId,
    customMetadata,
  };
};