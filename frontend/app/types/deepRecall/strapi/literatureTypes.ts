// literatureTypes.ts

import { StrapiResponse } from "../../strapiTypes";
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
  icon?: string; // Lucide icon name for the literature type
  linkedVersionType?: string; // Single version type name this literature type is linked to
  collections?: string[]; // Array of collection names this literature belongs to
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
 * Utility functions for version year display
 */

/**
 * Gets the display year(s) for a literature item based on its versions and type.
 * For papers: Returns the year of the version with the lowest edition/version number.
 * For other types: Returns a year range if multiple versions, single year if one version.
 */
export const getDisplayYear = (literature: LiteratureExtended): string | null => {
  if (!literature.versions || literature.versions.length === 0) {
    return null;
  }

  const versionsWithDates = literature.versions.filter(v => v.publishingDate);
  if (versionsWithDates.length === 0) {
    return null;
  }

  const isPaper = literature.type.toLowerCase() === 'paper';

  if (isPaper) {
    // For papers, get the version with the lowest edition/version number
    const sortedVersions = versionsWithDates.sort((a, b) => {
      const aNum = a.editionNumber ?? a.versionNumber ?? 999;
      const bNum = b.editionNumber ?? b.versionNumber ?? 999;
      return aNum - bNum;
    });
    const earliestVersion = sortedVersions[0];
    return new Date(earliestVersion.publishingDate!).getFullYear().toString();
  } else {
    // For other types, show range if multiple versions
    if (versionsWithDates.length === 1) {
      return new Date(versionsWithDates[0].publishingDate!).getFullYear().toString();
    } else {
      const years = versionsWithDates
        .map(v => new Date(v.publishingDate!).getFullYear())
        .sort((a, b) => a - b);
      const minYear = years[0];
      const maxYear = years[years.length - 1];
      return minYear === maxYear ? minYear.toString() : `${minYear}-${maxYear}`;
    }
  }
};

/**
 * Checks if any version of a literature item is marked as read.
 */
export const isLiteratureRead = (literature: LiteratureExtended): boolean => {
  if (!literature.versions || literature.versions.length === 0) {
    return false;
  }
  
  return literature.versions.some(version => version.read);
};

/**
 * Checks if any version of a literature item is marked as favorite.
 */
export const isLiteratureFavorite = (literature: LiteratureExtended): boolean => {
  if (!literature.versions || literature.versions.length === 0) {
    return false;
  }
  
  return literature.versions.some(version => version.favorite);
};

/**
 * Gets the earliest read date among all versions of a literature item.
 */
export const getLiteratureReadDate = (literature: LiteratureExtended): string | null => {
  if (!literature.versions || literature.versions.length === 0) {
    return null;
  }
  
  const readDates = literature.versions
    .filter(version => version.read)
    .map(version => version.read!)
    .sort();
  
  return readDates.length > 0 ? readDates[0] : null;
};

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

  // Extract supported literature fields and exclude versions from customMetadata.
  const { subtitle, publisher, authors, journal, doi, versionsAreEqual, icon, linkedVersionType, collections, versions, ...customMetadata } = metadataObj;

  // Transform versions stored in metadata.
  const rawVersions = Array.isArray(versions) ? versions : [];
  const transformedVersions = rawVersions.map(transformVersion);

  return {
    ...lit,
    subtitle,
    publisher,
    authors,
    journal,
    doi,
    versionsAreEqual,
    icon,
    linkedVersionType,
    collections,
    customMetadata,
    versions: transformedVersions,
  };
};
