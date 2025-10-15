/**
 * Library schema exports
 * Single entry point for all library-related types, schemas, and utilities
 */

// Core schemas and types
export * from "./library";

// Re-export for convenience
export {
  // Schemas
  WorkSchema,
  VersionSchema,
  AssetSchema,
  ActivitySchema,
  CollectionSchema,
  EdgeSchema,
  LibraryEntitySchema,
  PersonSchema,
  WorkTypeSchema,
  AssetRoleSchema,
  ActivityTypeSchema,
  RelationSchema,
  // Types
  type Work,
  type Version,
  type Asset,
  type Activity,
  type Collection,
  type Edge,
  type Person,
  type LibraryEntity,
  type WorkType,
  type AssetRole,
  type ActivityType,
  type Relation,
  // Extended types
  type WorkExtended,
  type VersionExtended,
  type AssetExtended,
  type ActivityExtended,
  type CollectionExtended,
  // Validation utilities
  validateLibraryEntity,
  safeValidateLibraryEntity,
  // Type guards
  isWork,
  isVersion,
  isAsset,
  isActivity,
  isCollection,
  // Helper functions
  getDisplayYear,
  isWorkRead,
  isWorkFavorite,
  getWorkReadDate,
  getDisplayColor,
  getDisplayIcon,
  collectionContainsWork,
  getCollectionWorkCount,
} from "./library";
