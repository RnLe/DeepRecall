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
  created_ms: integer("created_ms").notNull(), // timestamp when added to database
  filename: text("filename"), // optional, original filename
  health: text("health").default("healthy"), // healthy | missing | modified | relocated | duplicate
  // Image metadata
  imageWidth: integer("image_width"), // width in pixels for images
  imageHeight: integer("image_height"), // height in pixels for images
  // Text file metadata
  lineCount: integer("line_count"), // number of lines for text files
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
