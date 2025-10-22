/**
 * Schema and types for data export/import synchronization
 * Handles Dexie data, SQLite data, and file system data
 */

import { z } from "zod";
import type {
  Work,
  Asset,
  Activity,
  Collection,
  Edge,
  Author,
} from "./library";
import type { Annotation } from "./annotation";
import type { Card, ReviewLog } from "./cards";
import type { Preset } from "./presets";

/**
 * Export format version - increment when schema changes
 * Follows semantic versioning: MAJOR.MINOR.PATCH
 */
export const EXPORT_VERSION = "1.0.0";

/**
 * Dexie data export (all tables)
 */
export const DexieExportSchema = z.object({
  works: z.array(z.any()), // Work[]
  assets: z.array(z.any()), // Asset[]
  activities: z.array(z.any()), // Activity[]
  collections: z.array(z.any()), // Collection[]
  edges: z.array(z.any()), // Edge[]
  presets: z.array(z.any()), // Preset[]
  authors: z.array(z.any()), // Author[]
  annotations: z.array(z.any()), // Annotation[]
  cards: z.array(z.any()), // Card[]
  reviewLogs: z.array(z.any()), // ReviewLog[]
});

export type DexieExport = z.infer<typeof DexieExportSchema>;

/**
 * Typed version of DexieExport with proper types
 */
export interface DexieExportTyped {
  works: Work[];
  assets: Asset[];
  activities: Activity[];
  collections: Collection[];
  edges: Edge[];
  presets: Preset[];
  authors: Author[];
  annotations: Annotation[];
  cards: Card[];
  reviewLogs: ReviewLog[];
}

/**
 * SQLite blob metadata (from server)
 */
export const BlobRecordSchema = z.object({
  hash: z.string(), // SHA-256 hex string
  size: z.number(),
  mime: z.string(),
  mtime_ms: z.number(),
  created_ms: z.number(),
  filename: z.string().nullable(),
  health: z.string().nullable(),
  imageWidth: z.number().nullable(),
  imageHeight: z.number().nullable(),
  lineCount: z.number().nullable(),
});

export type BlobRecord = z.infer<typeof BlobRecordSchema>;

/**
 * SQLite path record (from server)
 */
export const PathRecordSchema = z.object({
  hash: z.string(), // SHA-256 hex string
  path: z.string(),
});

export type PathRecord = z.infer<typeof PathRecordSchema>;

/**
 * SQLite data export
 */
export const SQLiteExportSchema = z.object({
  blobs: z.array(BlobRecordSchema),
  paths: z.array(PathRecordSchema),
});

export type SQLiteExport = z.infer<typeof SQLiteExportSchema>;

/**
 * File system data manifest (what files are included)
 */
export const FileManifestSchema = z.object({
  avatars: z.array(z.string()), // List of avatar filenames
  libraryFiles: z.array(z.string()), // List of files in library folder (relative paths)
  dbFiles: z.array(z.string()), // List of .db files (cas.db, cas.db-shm, cas.db-wal)
  totalSize: z.number(), // Total size in bytes
});

export type FileManifest = z.infer<typeof FileManifestSchema>;

/**
 * Complete export metadata
 */
export const ExportMetadataSchema = z.object({
  version: z.string(), // EXPORT_VERSION
  exportedAt: z.string(), // ISO timestamp
  deviceName: z.string().optional(), // Optional device identifier
  dexieVersion: z.number(), // Dexie DB version at export time
  includeFiles: z.boolean(), // Whether file system files are included

  // Counts for preview
  counts: z.object({
    works: z.number(),
    assets: z.number(),
    activities: z.number(),
    collections: z.number(),
    edges: z.number(),
    presets: z.number(),
    authors: z.number(),
    annotations: z.number(),
    cards: z.number(),
    reviewLogs: z.number(),
    blobs: z.number(),
    paths: z.number(),
    files: z.number(),
  }),

  // Size information
  sizes: z.object({
    dexieData: z.number(), // Size in bytes
    sqliteData: z.number(),
    fileData: z.number(), // All files (library/, avatars, db)
    total: z.number(),
  }),
});

export type ExportMetadata = z.infer<typeof ExportMetadataSchema>;

/**
 * Complete export package structure
 * This is the JSON structure inside the archive
 */
export const ExportPackageSchema = z.object({
  metadata: ExportMetadataSchema,
  dexie: DexieExportSchema,
  sqlite: SQLiteExportSchema.optional(), // Only if includeSQLite
  files: FileManifestSchema.optional(), // Only if includeFiles
});

export type ExportPackage = z.infer<typeof ExportPackageSchema>;

/**
 * Export options (what to include)
 */
export const ExportOptionsSchema = z.object({
  includeDexie: z.boolean().default(true), // Always true, but explicit
  includeSQLite: z.boolean().default(false), // Include SQLite metadata (blobs + paths tables)
  includeFiles: z.boolean().default(true), // Include all files (library/, avatars, .db files)
  deviceName: z.string().optional(),
});

export type ExportOptions = z.infer<typeof ExportOptionsSchema>;

/**
 * Import strategy
 */
export const ImportStrategySchema = z.enum(["merge", "replace"]);
export type ImportStrategy = z.infer<typeof ImportStrategySchema>;

/**
 * Import options
 */
export const ImportOptionsSchema = z.object({
  strategy: ImportStrategySchema,
  importDexie: z.boolean().default(true),
  importSQLite: z.boolean().default(true),
  importFiles: z.boolean().default(true),
  skipExisting: z.boolean().default(false), // For merge: skip if exists
});

export type ImportOptions = z.infer<typeof ImportOptionsSchema>;

/**
 * Import preview (what would be imported)
 */
export const ImportPreviewSchema = z.object({
  metadata: ExportMetadataSchema,
  compatible: z.boolean(), // Is version compatible?
  warnings: z.array(z.string()), // Any warnings about the import

  // What exists locally vs in import
  conflicts: z.object({
    works: z.number(),
    assets: z.number(),
    activities: z.number(),
    collections: z.number(),
    edges: z.number(),
    presets: z.number(),
    authors: z.number(),
    annotations: z.number(),
    cards: z.number(),
    reviewLogs: z.number(),
  }),

  // What would be added (merge) or replaced (replace)
  changes: z.object({
    added: z.number(),
    updated: z.number(),
    removed: z.number(), // Only for replace strategy
  }),
});

export type ImportPreview = z.infer<typeof ImportPreviewSchema>;

/**
 * Import result
 */
export const ImportResultSchema = z.object({
  success: z.boolean(),
  imported: z.object({
    works: z.number(),
    assets: z.number(),
    activities: z.number(),
    collections: z.number(),
    edges: z.number(),
    presets: z.number(),
    authors: z.number(),
    annotations: z.number(),
    cards: z.number(),
    reviewLogs: z.number(),
    blobs: z.number(),
    paths: z.number(),
    files: z.number(),
  }),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type ImportResult = z.infer<typeof ImportResultSchema>;

/**
 * Archive structure (inside .tar.gz or .zip)
 * - manifest.json (ExportPackage)
 * - dexie/ (JSON files per table)
 * - sqlite/ (SQL dump or JSON)
 * - files/avatars/ (avatar images)
 * - files/db/ (.db files)
 * - files/library/ (library folder contents - includes all PDFs, notes, etc.)
 */
export const ARCHIVE_STRUCTURE = {
  MANIFEST: "manifest.json",
  DEXIE_DIR: "dexie/",
  SQLITE_DIR: "sqlite/",
  FILES_DIR: "files/",
  AVATARS_DIR: "files/avatars/",
  DB_DIR: "files/db/",
  LIBRARY_DIR: "files/library/",
} as const;
