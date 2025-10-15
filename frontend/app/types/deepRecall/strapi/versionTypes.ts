import { StrapiResponse } from "../../strapiTypes";
import { MediaFile } from "../../strapiTypes";

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
  read?: string; // Date when the version was marked as read (ISO string)
  favorite?: boolean; // Whether the version is marked as favorite
}

/**
 * Extended version with parsed metadata and full file information.
 */
export interface VersionExtended extends VersionType, SupportedVersionFields {
  fileUrl: string;
  thumbnailUrl: string;
  customMetadata: DynamicMetadata;
  fileHash: string;
  fileId?: number; // Strapi file ID for the PDF file
  thumbnailId?: number; // Strapi file ID for the thumbnail image
  
  // Enhanced file information
  pdfFile?: MediaFile; // Full PDF MediaFile object
  thumbnailFile?: MediaFile; // Full thumbnail MediaFile object
  
  // Cached metadata to avoid repeated processing
  fileSize?: number; // File size in bytes
  totalPages?: number; // Number of pages in PDF
  fileName?: string; // Original filename
  annotationCount?: number; // Count of annotations for this version
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
  
  const { 
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
    pdfFile,
    thumbnailFile,
    fileSize,
    totalPages,
    fileName,
    annotationCount,
    read,
    favorite,
    ...customMetadata 
  } = metadataObj;
  
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
    pdfFile,
    thumbnailFile,
    fileSize,
    totalPages,
    fileName,
    annotationCount,
    read,
    favorite,
    customMetadata,
  };
};