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
  type AssetExtended,
  type ActivityExtended,
  type CollectionExtended,
  // Validation utilities
  validateLibraryEntity,
  safeValidateLibraryEntity,
  // Type guards
  isWork,
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
