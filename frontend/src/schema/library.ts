/**
 * Library schema: Work → Version → Asset hierarchy
 * Plus Activity (courses/projects) and Collection (curation)
 *
 * Mental model:
 * - Work = abstract intellectual identity (book/paper as a "work")
 * - Version = concrete edition/revision tied to publication event
 * - Asset = actual file bound to blob hash (sha256)
 * - Activity = rich aggregate (course/project with schedule + participants)
 * - Collection = shallow grouping (curation, optionally ordered)
 * - Edge = typed relation connecting entities
 *
 * All stored in Dexie (browser-side), except blobs (server CAS).
 * Zod schemas are the single source of truth → infer TS types.
 */

import { z } from "zod";

// ============================================================================
// Shared Primitives
// ============================================================================

/**
 * UUID for local entities (client-generated, deterministic where needed)
 */
export const Id = z.string().uuid();

/**
 * ISO 8601 datetime string
 */
export const ISODate = z.string().datetime();

/**
 * Year for publication dates
 */
const Year = z.number().int().min(0).max(3000);

/**
 * Hex color for UI theming
 */
export const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/**
 * Lucide icon name (string for now; could be enum later)
 */
export const IconName = z.string();

// ============================================================================
// Person (lightweight; expand as needed)
// ============================================================================

export const PersonSchema = z.object({
  name: z.string(),
  orcid: z.string().url().optional(),
  affiliation: z.string().optional(),
});

export type Person = z.infer<typeof PersonSchema>;

// ============================================================================
// Work = abstract identity of a book/paper/notes
// ============================================================================

export const WorkTypeSchema = z.enum([
  "paper",
  "textbook",
  "thesis",
  "notes",
  "slides",
  "dataset",
  "article",
  "book",
  "report",
  "other",
]);

export type WorkType = z.infer<typeof WorkTypeSchema>;

export const WorkSchema = z.object({
  id: Id,
  kind: z.literal("work"),

  // Core identity
  title: z.string(),
  subtitle: z.string().optional(),
  authors: z.array(PersonSchema).default([]),
  workType: WorkTypeSchema.default("paper"),

  // Topics/tags at the Work level (not version-specific)
  topics: z.array(z.string()).default([]),

  // UI metadata (optional)
  icon: IconName.optional(),
  color: HexColor.optional(),

  // User flags
  favorite: z.boolean().default(false),

  // Flexible metadata (custom fields from presets)
  metadata: z.record(z.string(), z.unknown()).optional(),

  // Timestamps
  createdAt: ISODate,
  updatedAt: ISODate,
});

export type Work = z.infer<typeof WorkSchema>;

// ============================================================================
// Version = concrete edition/revision/issue
// ============================================================================

export const VersionSchema = z.object({
  id: Id,
  kind: z.literal("version"),

  // Foreign key to Work
  workId: Id,

  // Edition/version identity
  edition: z.string().optional(), // "3rd", "v2", "rev. 2021"
  versionNumber: z.number().int().min(1).optional(),

  // Publication metadata
  year: Year.optional(),
  publishingDate: ISODate.optional(), // Full date if known
  publisher: z.string().optional(),

  // Journal/conference (for papers)
  journal: z.string().optional(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(), // "123-147"

  // Academic identifiers
  doi: z.string().optional(),
  arxivId: z.string().optional(),
  isbn: z.string().optional(),

  // Optional title override (if version has distinct title)
  versionTitle: z.string().optional(),

  // User notes
  notes: z.string().optional(),

  // User flags
  read: ISODate.optional(), // When marked as read
  favorite: z.boolean().default(false),

  // Flexible metadata (custom fields from presets)
  metadata: z.record(z.string(), z.unknown()).optional(),

  // Timestamps
  createdAt: ISODate,
  updatedAt: ISODate,
});

export type Version = z.infer<typeof VersionSchema>;

// ============================================================================
// Asset = concrete file bound to CAS blob by sha256
// ============================================================================

export const AssetRoleSchema = z.enum([
  "main",
  "supplement",
  "slides",
  "solutions",
  "data",
  "notes",
  "exercises",
]);

export type AssetRole = z.infer<typeof AssetRoleSchema>;

export const AssetSchema = z.object({
  id: Id,
  kind: z.literal("asset"),

  // Foreign key to Version (optional - can be standalone)
  versionId: Id.optional(),

  // Join key to server CAS (blobs table)
  sha256: z.string(),

  // File metadata (cached from server or extraction)
  filename: z.string(),
  bytes: z.number().int().min(0),
  mime: z.string(),

  // PDF-specific (optional)
  pageCount: z.number().int().min(1).optional(),

  // Role in the version (main text, slides, etc.)
  role: AssetRoleSchema.default("main"),

  // For multi-part assets (e.g., script part 0, 1, 2...)
  partIndex: z.number().int().min(0).optional(),

  // Thumbnail (optional; stored as data URL or separate blob hash)
  thumbnailUrl: z.string().optional(),

  // Flexible metadata (custom fields from presets)
  metadata: z.record(z.string(), z.unknown()).optional(),

  // Timestamps
  createdAt: ISODate,
  updatedAt: ISODate,
});

export type Asset = z.infer<typeof AssetSchema>;

// ============================================================================
// Activity = rich aggregate (course, workshop, project, thesis)
// ============================================================================

export const ActivityTypeSchema = z.enum([
  "course",
  "workshop",
  "project",
  "thesis",
  "seminar",
  "reading_group",
  "conference",
]);

export type ActivityType = z.infer<typeof ActivityTypeSchema>;

export const ActivitySchema = z.object({
  id: Id,
  kind: z.literal("activity"),

  // Core identity
  activityType: ActivityTypeSchema,
  title: z.string(),
  description: z.string().optional(),

  // Organizational metadata
  institution: z.string().optional(),
  participants: z.array(PersonSchema).default([]),

  // Time bounds
  startsAt: ISODate.optional(),
  endsAt: ISODate.optional(),

  // UI metadata
  icon: IconName.optional(),
  color: HexColor.optional(),

  // Timestamps
  createdAt: ISODate,
  updatedAt: ISODate,
});

export type Activity = z.infer<typeof ActivitySchema>;

// ============================================================================
// Collection = shallow curation bucket
// ============================================================================

export const CollectionSchema = z.object({
  id: Id,
  kind: z.literal("collection"),

  // Core identity
  name: z.string(),
  description: z.string().optional(),

  // Whether order matters (for display)
  ordered: z.boolean().default(false),

  // UI metadata
  icon: IconName.optional(),
  color: HexColor.optional(),

  // Privacy flag
  isPrivate: z.boolean().default(false),

  // Tags for organizing collections themselves
  tags: z.array(z.string()).default([]),

  // Timestamps
  createdAt: ISODate,
  updatedAt: ISODate,
});

export type Collection = z.infer<typeof CollectionSchema>;

// ============================================================================
// Edge = typed relation between entities
// ============================================================================

export const RelationSchema = z.enum([
  "contains", // A contains B (Collection→Work, Activity→Version, Version→Asset)
  "assignedIn", // Work/Version assigned in Activity
  "partOf", // Asset partOf Version, Version partOf Activity module
  "cites", // Work/Version cites Work/Version
  "relatedTo", // Loose link
  "prerequisite", // Work A is prerequisite for Work B
  "references", // Generic reference link
]);

export type Relation = z.infer<typeof RelationSchema>;

export const EdgeSchema = z.object({
  id: Id,

  // From/to entity IDs (any entity type)
  fromId: Id,
  toId: Id,

  // Typed relation
  relation: RelationSchema,

  // Optional ordering (for "contains" in ordered collections)
  order: z.number().int().min(0).optional(),

  // Optional metadata (JSON string for arbitrary data)
  metadata: z.string().optional(),

  // Timestamps
  createdAt: ISODate,
});

export type Edge = z.infer<typeof EdgeSchema>;

// ============================================================================
// Union type for all library entities
// ============================================================================

export const LibraryEntitySchema = z.discriminatedUnion("kind", [
  WorkSchema,
  VersionSchema,
  AssetSchema,
  ActivitySchema,
  CollectionSchema,
]);

export type LibraryEntity = z.infer<typeof LibraryEntitySchema>;

// ============================================================================
// Utility types for extended entities (with resolved relations)
// ============================================================================

/**
 * Version with resolved Work reference
 */
export interface VersionExtended extends Version {
  work?: Work;
  assets?: Asset[];
}

/**
 * Asset with resolved Version and Work references
 */
export interface AssetExtended extends Asset {
  version?: Version;
  work?: Work;
}

/**
 * Work with resolved Versions and Assets
 */
export interface WorkExtended extends Work {
  versions?: VersionExtended[];
}

/**
 * Activity with resolved contained entities (via edges)
 */
export interface ActivityExtended extends Activity {
  works?: Work[];
  versions?: Version[];
  assets?: Asset[];
}

/**
 * Collection with resolved contained entities (via edges)
 */
export interface CollectionExtended extends Collection {
  works?: Work[];
  versions?: Version[];
  activities?: Activity[];
}

// ============================================================================
// Validation utilities
// ============================================================================

/**
 * Validate and parse a library entity (throws on invalid)
 */
export function validateLibraryEntity(data: unknown): LibraryEntity {
  return LibraryEntitySchema.parse(data);
}

/**
 * Safely validate a library entity (returns error on invalid)
 */
export function safeValidateLibraryEntity(data: unknown) {
  return LibraryEntitySchema.safeParse(data);
}

/**
 * Type guard for Work
 */
export function isWork(entity: LibraryEntity): entity is Work {
  return entity.kind === "work";
}

/**
 * Type guard for Version
 */
export function isVersion(entity: LibraryEntity): entity is Version {
  return entity.kind === "version";
}

/**
 * Type guard for Asset
 */
export function isAsset(entity: LibraryEntity): entity is Asset {
  return entity.kind === "asset";
}

/**
 * Type guard for Activity
 */
export function isActivity(entity: LibraryEntity): entity is Activity {
  return entity.kind === "activity";
}

/**
 * Type guard for Collection
 */
export function isCollection(entity: LibraryEntity): entity is Collection {
  return entity.kind === "collection";
}

// ============================================================================
// Helper functions (port from old literatureTypes.ts)
// ============================================================================

/**
 * Gets the display year for a work based on its versions.
 * For papers: returns year of earliest version.
 * For other types: returns year range if multiple versions.
 */
export function getDisplayYear(work: WorkExtended): string | null {
  if (!work.versions || work.versions.length === 0) {
    return null;
  }

  const versionsWithYears = work.versions.filter((v) => v.year);
  if (versionsWithYears.length === 0) {
    return null;
  }

  const isPaper = work.workType === "paper";

  if (isPaper) {
    // For papers, get the earliest version
    const sortedVersions = versionsWithYears.sort((a, b) => {
      const aNum = a.versionNumber ?? 999;
      const bNum = b.versionNumber ?? 999;
      return aNum - bNum;
    });
    return sortedVersions[0].year!.toString();
  } else {
    // For other types, show range if multiple versions
    if (versionsWithYears.length === 1) {
      return versionsWithYears[0].year!.toString();
    } else {
      const years = versionsWithYears.map((v) => v.year!).sort((a, b) => a - b);
      const minYear = years[0];
      const maxYear = years[years.length - 1];
      return minYear === maxYear ? minYear.toString() : `${minYear}-${maxYear}`;
    }
  }
}

/**
 * Checks if any version of a work is marked as read.
 */
export function isWorkRead(work: WorkExtended): boolean {
  if (!work.versions || work.versions.length === 0) {
    return false;
  }
  return work.versions.some((v) => v.read !== undefined);
}

/**
 * Checks if any version of a work is marked as favorite.
 */
export function isWorkFavorite(work: WorkExtended): boolean {
  if (work.favorite) {
    return true;
  }
  if (!work.versions || work.versions.length === 0) {
    return false;
  }
  return work.versions.some((v) => v.favorite);
}

/**
 * Gets the earliest read date among all versions of a work.
 */
export function getWorkReadDate(work: WorkExtended): string | null {
  if (!work.versions || work.versions.length === 0) {
    return null;
  }

  const readDates = work.versions
    .filter((v) => v.read)
    .map((v) => v.read!)
    .sort();

  return readDates.length > 0 ? readDates[0] : null;
}

/**
 * Gets a display color for an entity with fallback.
 */
export function getDisplayColor(entity: Work | Activity | Collection): string {
  return entity.color || "#6366f1"; // Default to indigo-500
}

/**
 * Gets a display icon for an entity with fallback.
 */
export function getDisplayIcon(entity: Work | Activity | Collection): string {
  return entity.icon || "BookOpen"; // Default to BookOpen icon
}

/**
 * Checks if a collection contains a specific work (via edges).
 */
export function collectionContainsWork(
  collection: CollectionExtended,
  workId: string
): boolean {
  return collection.works
    ? collection.works.some((w) => w.id === workId)
    : false;
}

/**
 * Gets the count of works in a collection.
 */
export function getCollectionWorkCount(collection: CollectionExtended): number {
  return collection.works ? collection.works.length : 0;
}
