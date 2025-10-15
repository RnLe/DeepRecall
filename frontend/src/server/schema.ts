/**
 * Drizzle ORM schema for SQLite (server-side only)
 * Tables: blobs (hash→metadata), paths (hash→filesystem path)
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * blobs: content-addressed storage
 * Primary key is SHA-256 hash of file content
 */
export const blobs = sqliteTable("blobs", {
  hash: text("hash").primaryKey(), // SHA-256 hex string
  size: integer("size").notNull(),
  mime: text("mime").notNull(),
  mtime_ms: integer("mtime_ms").notNull(), // last modified time in milliseconds
  page_count: integer("page_count"), // optional, for PDFs
});

/**
 * paths: maps hash to filesystem paths
 * One blob can have multiple paths (e.g., copies/symlinks)
 */
export const paths = sqliteTable("paths", {
  hash: text("hash")
    .notNull()
    .references(() => blobs.hash, { onDelete: "cascade" }),
  path: text("path").notNull().primaryKey(), // absolute filesystem path
});
