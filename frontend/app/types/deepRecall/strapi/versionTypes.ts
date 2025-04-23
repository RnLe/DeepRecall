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
}

/**
 * Extended version with parsed metadata.
 */
export interface VersionExtended extends VersionType, SupportedVersionFields {
  fileUrl: string;
  thumbnailUrl: string;
  customMetadata: DynamicMetadata;
  fileHash: string;
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
  
  const { fileUrl, thumbnailUrl, publishingDate, versionTitle, editionNumber, versionNumber, fileHash, ...customMetadata } = metadataObj;
  return {
    ...version,
    fileUrl,
    thumbnailUrl,
    publishingDate,
    versionTitle,
    editionNumber,
    versionNumber,
    fileHash,
    customMetadata,
  };
};