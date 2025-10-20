/**
 * Dexie database setup
 * Local-first durable storage for library entities, annotations, cards, review logs
 */

import Dexie, { type EntityTable } from "dexie";
import type { Annotation } from "@/src/schema/annotation";
import type { Card, ReviewLog } from "@/src/schema/cards";
import type {
  Work,
  Asset,
  Activity,
  Collection,
  Edge,
  Author,
} from "@/src/schema/library";
import type { Preset } from "@/src/schema/presets";

class DeepRecallDB extends Dexie {
  // Library entities
  works!: EntityTable<Work, "id">;
  assets!: EntityTable<Asset, "id">;
  activities!: EntityTable<Activity, "id">;
  collections!: EntityTable<Collection, "id">;
  edges!: EntityTable<Edge, "id">;
  presets!: EntityTable<Preset, "id">;
  authors!: EntityTable<Author, "id">;

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

    // Version 3: Remove versions table, change assets.versionId → assets.workId
    this.version(3)
      .stores({
        // Library tables (remove versions, update assets)
        works:
          "id, workType, title, favorite, allowMultipleAssets, presetId, year, read, createdAt, updatedAt",
        versions: null, // Delete versions table
        assets:
          "id, workId, sha256, role, mime, year, read, favorite, presetId, createdAt, updatedAt",
        activities:
          "id, activityType, title, startsAt, endsAt, createdAt, updatedAt",
        collections: "id, name, isPrivate, createdAt, updatedAt",
        edges: "id, fromId, toId, relation, createdAt",
        presets: "id, name, targetEntity, isSystem, createdAt, updatedAt",

        // Annotations & cards
        annotations:
          "id, sha256, [sha256+page], page, type, createdAt, updatedAt",
        cards: "id, annotation_id, sha256, due, state, created_ms",
        reviewLogs: "id, card_id, review_ms",
      })
      .upgrade(async (tx) => {
        console.log(
          "Upgrading database to version 3 (removing versions, migrating to Work→Asset)"
        );

        // Migrate version data to works and assets
        const oldWorks = await tx.table("works").toArray();
        const oldVersions = await tx.table("versions").toArray();
        const oldAssets = await tx.table("assets").toArray();

        // For each work, if it has versions, merge metadata and update allowMultipleAssets
        for (const work of oldWorks) {
          const workVersions = oldVersions.filter(
            (v: any) => v.workId === work.id
          );

          // Set allowMultipleAssets based on version count
          const updates: any = {
            allowMultipleAssets: workVersions.length > 1,
          };

          // If single version, merge its metadata into work
          if (workVersions.length === 1) {
            const version = workVersions[0];
            updates.year = version.year;
            updates.publishingDate = version.publishingDate;
            updates.publisher = version.publisher;
            updates.journal = version.journal;
            updates.volume = version.volume;
            updates.issue = version.issue;
            updates.pages = version.pages;
            updates.doi = version.doi;
            updates.arxivId = version.arxivId;
            updates.isbn = version.isbn;
            updates.read = version.read;
            updates.notes = version.notes;
            // Keep work.favorite if already set, otherwise use version.favorite
            if (!work.favorite && version.favorite) {
              updates.favorite = true;
            }
          }

          await tx.table("works").update(work.id, updates);
        }

        // Update assets: versionId → workId
        for (const asset of oldAssets) {
          if (asset.versionId) {
            const version = oldVersions.find(
              (v: any) => v.id === asset.versionId
            );
            if (version) {
              await tx.table("assets").update(asset.id, {
                workId: version.workId,
                versionId: undefined, // Remove old field
              });
            }
          }
        }

        console.log(
          `✅ Migrated ${oldWorks.length} works, ${oldVersions.length} versions → ${oldAssets.length} assets`
        );
      });

    // Version 4: Add annotation attachment support
    this.version(4)
      .stores({
        // Library tables (add annotationId, purpose indexes to assets)
        works:
          "id, workType, title, favorite, allowMultipleAssets, presetId, year, read, createdAt, updatedAt",
        assets:
          "id, workId, annotationId, sha256, role, purpose, mime, year, read, favorite, presetId, createdAt, updatedAt",
        activities:
          "id, activityType, title, startsAt, endsAt, createdAt, updatedAt",
        collections: "id, name, isPrivate, createdAt, updatedAt",
        edges: "id, fromId, toId, relation, createdAt",
        presets: "id, name, targetEntity, isSystem, createdAt, updatedAt",

        // Annotations table (unchanged - attachedAssets is in metadata JSON)
        annotations:
          "id, sha256, [sha256+page], page, type, createdAt, updatedAt",
        cards: "id, annotation_id, sha256, due, state, created_ms",
        reviewLogs: "id, card_id, review_ms",
      })
      .upgrade(async (tx) => {
        console.log(
          "Upgrading database to version 4 (adding annotation attachment support)"
        );

        // No data migration needed - new fields are optional
        // Existing annotations without attachedAssets are valid
        // Existing assets without purpose/annotationId are valid

        console.log(
          "✅ Database upgraded to v4 - annotation attachment support enabled"
        );
      });

    // Version 5: Add Authors table and migrate Work.authors to authorIds
    this.version(5)
      .stores({
        // Add authors table
        authors:
          "id, lastName, firstName, orcid, affiliation, createdAt, updatedAt",

        // Library tables (unchanged)
        works:
          "id, workType, title, favorite, allowMultipleAssets, presetId, year, read, createdAt, updatedAt, *authorIds",
        assets:
          "id, workId, annotationId, sha256, role, purpose, mime, year, read, favorite, presetId, createdAt, updatedAt",
        activities:
          "id, activityType, title, startsAt, endsAt, createdAt, updatedAt",
        collections: "id, name, isPrivate, createdAt, updatedAt",
        edges: "id, fromId, toId, relation, createdAt",
        presets: "id, name, targetEntity, isSystem, createdAt, updatedAt",

        // Annotations & cards (unchanged)
        annotations:
          "id, sha256, [sha256+page], page, type, createdAt, updatedAt",
        cards: "id, annotation_id, sha256, due, state, created_ms",
        reviewLogs: "id, card_id, review_ms",
      })
      .upgrade(async (tx) => {
        console.log(
          "Upgrading database to version 5 (adding Authors table and migrating author data)"
        );

        const works = await tx.table("works").toArray();
        let authorsCreated = 0;
        let worksUpdated = 0;

        // Create a map to deduplicate authors by full name
        const authorMap = new Map<string, string>(); // key: full name, value: author ID

        for (const work of works) {
          if (!work.authors || work.authors.length === 0) {
            // No authors to migrate, but set authorIds to empty array
            await tx.table("works").update(work.id, { authorIds: [] });
            worksUpdated++;
            continue;
          }

          const authorIds: string[] = [];

          for (const oldAuthor of work.authors) {
            const fullName = oldAuthor.name.trim();
            if (!fullName) continue;

            // Check if we've already created this author
            let authorId = authorMap.get(fullName);

            if (!authorId) {
              // Parse name (simple: assume "First Last" or "Last, First" format)
              let firstName = "";
              let lastName = "";

              if (fullName.includes(",")) {
                // "Last, First" format
                const parts = fullName.split(",").map((s) => s.trim());
                lastName = parts[0] || "";
                firstName = parts[1] || "";
              } else {
                // "First Last" format (or single name)
                const parts = fullName.split(" ").filter((s) => s);
                if (parts.length === 1) {
                  lastName = parts[0];
                } else {
                  firstName = parts.slice(0, -1).join(" ");
                  lastName = parts[parts.length - 1];
                }
              }

              // Generate new author ID
              const { v4: uuidv4 } = await import("uuid");
              authorId = uuidv4();

              // Create author entity
              const now = new Date().toISOString();
              await tx.table("authors").add({
                id: authorId,
                kind: "author",
                firstName,
                lastName,
                affiliation: oldAuthor.affiliation,
                orcid: oldAuthor.orcid,
                createdAt: now,
                updatedAt: now,
              });

              authorMap.set(fullName, authorId);
              authorsCreated++;
            }

            authorIds.push(authorId);
          }

          // Update work with authorIds
          await tx.table("works").update(work.id, { authorIds });
          worksUpdated++;
        }

        console.log(
          `✅ Database upgraded to v5: Created ${authorsCreated} authors, updated ${worksUpdated} works`
        );
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
