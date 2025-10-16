/**
 * Dexie database setup
 * Local-first durable storage for library entities, annotations, cards, review logs
 */

import Dexie, { type EntityTable } from "dexie";
import type { Annotation } from "@/src/schema/annotations";
import type { Card, ReviewLog } from "@/src/schema/cards";
import type {
  Work,
  Version,
  Asset,
  Activity,
  Collection,
  Edge,
} from "@/src/schema/library";
import type { Preset } from "@/src/schema/presets";

class DeepRecallDB extends Dexie {
  // Library entities
  works!: EntityTable<Work, "id">;
  versions!: EntityTable<Version, "id">;
  assets!: EntityTable<Asset, "id">;
  activities!: EntityTable<Activity, "id">;
  collections!: EntityTable<Collection, "id">;
  edges!: EntityTable<Edge, "id">;
  presets!: EntityTable<Preset, "id">;

  // Annotations & cards
  annotations!: EntityTable<Annotation, "id">;
  cards!: EntityTable<Card, "id">;
  reviewLogs!: EntityTable<ReviewLog, "id">;

  constructor() {
    super("DeepRecallDB");
    this.version(1).stores({
      // Library tables
      works: "id, workType, title, favorite, createdAt, updatedAt",
      versions:
        "id, workId, year, publishingDate, read, favorite, createdAt, updatedAt",
      assets: "id, versionId, sha256, role, mime, createdAt, updatedAt",
      activities:
        "id, activityType, title, startsAt, endsAt, createdAt, updatedAt",
      collections: "id, name, isPrivate, createdAt, updatedAt",
      edges: "id, fromId, toId, relation, createdAt",
      presets: "id, name, targetEntity, isSystem, createdAt, updatedAt",

      // Annotations & cards
      annotations: "id, sha256, page, type, created_ms",
      cards: "id, annotation_id, sha256, due, state, created_ms",
      reviewLogs: "id, card_id, review_ms",
    });

    // Version 2: Add presetId indexes for tracking template usage
    this.version(2)
      .stores({
        // Library tables (add presetId index)
        works: "id, workType, title, favorite, presetId, createdAt, updatedAt",
        versions:
          "id, workId, year, publishingDate, read, favorite, presetId, createdAt, updatedAt",
        assets:
          "id, versionId, sha256, role, mime, presetId, createdAt, updatedAt",
        activities:
          "id, activityType, title, startsAt, endsAt, createdAt, updatedAt",
        collections: "id, name, isPrivate, createdAt, updatedAt",
        edges: "id, fromId, toId, relation, createdAt",
        presets: "id, name, targetEntity, isSystem, createdAt, updatedAt",

        // Annotations & cards (unchanged)
        annotations: "id, sha256, page, type, created_ms",
        cards: "id, annotation_id, sha256, due, state, created_ms",
        reviewLogs: "id, card_id, review_ms",
      })
      .upgrade(async (tx) => {
        // Migration: existing records don't need changes
        // presetId is optional, so existing records without it are valid
        console.log(
          "Upgrading database to version 2 (adding presetId indexes)"
        );
        // No data transformation needed - just index changes
      });
  }
}

export const db = new DeepRecallDB();

// Add error handling for database opening
db.on("versionchange", () => {
  console.warn("Database version changed by another tab");
  db.close();
  window.location.reload();
});
