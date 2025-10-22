/**
 * Type utilities and helper functions for library entities
 * Common operations that span multiple entity types
 */

import type {
  Work,
  Asset,
  Activity,
  Collection,
  LibraryEntity,
  WorkExtended,
  AssetExtended,
} from "@deeprecall/core/schemas/library";

// ============================================================================
// Entity type utilities
// ============================================================================

/**
 * Extract entity kind from discriminated union
 */
export type EntityKind = LibraryEntity["kind"];

/**
 * Map entity kind to entity type
 */
export type EntityTypeMap = {
  work: Work;
  asset: Asset;
  activity: Activity;
  collection: Collection;
};

/**
 * Type guard to check if an entity is of a specific kind
 */
export function isEntityOfKind<K extends EntityKind>(
  entity: LibraryEntity,
  kind: K
): entity is EntityTypeMap[K] {
  return entity.kind === kind;
}

// ============================================================================
// Display utilities
// ============================================================================

/**
 * Get a human-readable display name for an entity
 */
export function getEntityDisplayName(entity: LibraryEntity): string {
  switch (entity.kind) {
    case "work":
      return entity.title;
    case "asset":
      return entity.filename;
    case "activity":
      return entity.title;
    case "collection":
      return entity.name;
  }
}

/**
 * Get a human-readable type label for an entity
 */
export function getEntityTypeLabel(entity: LibraryEntity): string {
  switch (entity.kind) {
    case "work":
      return entity.workType.charAt(0).toUpperCase() + entity.workType.slice(1);
    case "asset":
      return "File";
    case "activity":
      return (
        entity.activityType.charAt(0).toUpperCase() +
        entity.activityType.slice(1)
      );
    case "collection":
      return "Collection";
  }
}

// ============================================================================
// Work helpers
// ============================================================================

/**
 * Get primary author(s) display string from author entities
 * @param authors - Array of Author entities
 * @param maxAuthors - Maximum number of authors to display before "et al."
 */
export function getPrimaryAuthors(
  authors: any[],
  maxAuthors: number = 3
): string {
  if (!authors || authors.length === 0) {
    return "Unknown Author";
  }

  // Get full names from author entities
  const names = authors.map((author) => {
    if (typeof author === "string") return author;
    if (author.firstName && author.lastName) {
      return `${author.firstName} ${author.lastName}`;
    }
    return author.name || "Unknown";
  });

  if (names.length <= maxAuthors) {
    return names.join(", ");
  }

  const firstAuthors = names.slice(0, maxAuthors).join(", ");
  return `${firstAuthors}, et al.`;
}

/**
 * Get a citation-style string for a work
 * Format: "Author(s) (Year). Title."
 * Note: This function now requires author entities to be resolved separately
 */
export function getCitationString(
  work: WorkExtended,
  authors: any[] = []
): string {
  const authorsStr = getPrimaryAuthors(authors, 2);
  const year = getDisplayYearForWork(work);
  const yearStr = year ? ` (${year})` : "";
  return `${authorsStr}${yearStr}. ${work.title}.`;
}

/**
 * Get display year for a work (from its versions)
 * Public wrapper for UI components
 */
export function getDisplayYear(work: WorkExtended): string | null {
  return getDisplayYearForWork(work);
}

/**
 * Get display year for a work
 * Internal implementation
 */
function getDisplayYearForWork(work: WorkExtended): string | null {
  // Use work.year directly, or fall back to asset years
  if (work.year) {
    return work.year.toString();
  }

  // Check asset years as fallback
  if (!work.assets || work.assets.length === 0) {
    return null;
  }

  const assetsWithYears = work.assets.filter((a) => a.year);
  if (assetsWithYears.length === 0) {
    return null;
  }

  // Get the earliest asset year
  const years = assetsWithYears.map((a) => a.year!).sort((a, b) => a - b);
  const minYear = years[0];
  const maxYear = years[years.length - 1];
  return minYear === maxYear ? minYear.toString() : `${minYear}-${maxYear}`;
}

// ============================================================================
// Asset helpers
// ============================================================================

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/**
 * Check if asset is a PDF
 */
export function isPDF(asset: Asset): boolean {
  return (
    asset.mime === "application/pdf" ||
    getFileExtension(asset.filename) === "pdf"
  );
}

/**
 * Get a full display name for an asset (including work if available)
 */
export function getAssetFullName(asset: AssetExtended): string {
  const parts: string[] = [];

  if (asset.work) {
    parts.push(asset.work.title);
  }

  // Show edition/version info if available on the asset
  if (asset.edition) {
    parts.push(`(${asset.edition})`);
  } else if (asset.versionNumber) {
    parts.push(`(v${asset.versionNumber})`);
  }

  if (asset.role !== "main") {
    parts.push(`[${asset.role}]`);
  }

  parts.push(`- ${asset.filename}`);

  return parts.join(" ");
}

// ============================================================================
// Activity helpers
// ============================================================================

/**
 * Check if an activity is currently active
 */
export function isActivityActive(activity: Activity): boolean {
  const now = new Date().toISOString();
  return (
    !!activity.startsAt &&
    activity.startsAt <= now &&
    (!activity.endsAt || activity.endsAt >= now)
  );
}

/**
 * Check if an activity is upcoming
 */
export function isActivityUpcoming(activity: Activity): boolean {
  const now = new Date().toISOString();
  return !!activity.startsAt && activity.startsAt > now;
}

/**
 * Check if an activity is past
 */
export function isActivityPast(activity: Activity): boolean {
  const now = new Date().toISOString();
  return !!activity.endsAt && activity.endsAt < now;
}

/**
 * Get activity duration in days
 */
export function getActivityDuration(activity: Activity): number | null {
  if (!activity.startsAt || !activity.endsAt) {
    return null;
  }

  const start = new Date(activity.startsAt);
  const end = new Date(activity.endsAt);
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Format activity date range for display
 */
export function formatActivityDateRange(activity: Activity): string {
  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (activity.startsAt && activity.endsAt) {
    return `${formatDate(activity.startsAt)} - ${formatDate(activity.endsAt)}`;
  } else if (activity.startsAt) {
    return `From ${formatDate(activity.startsAt)}`;
  } else if (activity.endsAt) {
    return `Until ${formatDate(activity.endsAt)}`;
  }

  return "No dates set";
}

// ============================================================================
// Collection helpers
// ============================================================================

/**
 * Get count of items in a collection (from extended data)
 */
export function getCollectionItemCount(collection: {
  works?: Work[];
  assets?: Asset[];
  activities?: Activity[];
}): number {
  return (
    (collection.works?.length || 0) +
    (collection.assets?.length || 0) +
    (collection.activities?.length || 0)
  );
}

// ============================================================================
// Sorting utilities
// ============================================================================

/**
 * Compare function for sorting works by title
 */
export function compareWorksByTitle(a: Work, b: Work): number {
  return a.title.localeCompare(b.title);
}

/**
 * Compare function for sorting works by creation date (newest first)
 */
export function compareWorksByDate(a: Work, b: Work): number {
  return b.createdAt.localeCompare(a.createdAt);
}

/**
 * Compare function for sorting activities by start date (earliest first)
 */
export function compareActivitiesByDate(a: Activity, b: Activity): number {
  const aDate = a.startsAt || a.endsAt || "9999";
  const bDate = b.startsAt || b.endsAt || "9999";
  return aDate.localeCompare(bDate);
}
