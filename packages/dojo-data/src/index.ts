/**
 * @deeprecall/dojo-data
 *
 * Data layer for the Dojo module - Electric/Postgres repository implementations
 *
 * This package provides:
 * - Database row types (matching SQL schema)
 * - Mappers between DB rows and domain types
 * - Electric read hooks for real-time data sync
 * - Write operations via WriteBuffer for optimistic updates
 * - Local (Dexie) repositories for offline support
 * - Merged repositories combining synced + local data
 * - Cleanup utilities for synced local changes
 */

// Types
export * from "./types";

// Mappers
export * from "./mappers";

// Repositories (Electric hooks + write operations + local + merged + cleanup)
export * from "./repos";

// Database (Dexie local storage)
export * from "./db";
