/**
 * Dexie database setup
 * Local-first durable storage for library entities, annotations, cards, review logs
 */

import Dexie, { type EntityTable } from "dexie";
import type { Annotation } from "@deeprecall/core";
import type { Card, ReviewLog } from "@deeprecall/core";
import type {
  Work,
  Asset,
  Activity,
  Collection,
  Edge,
  Author,
} from "@deeprecall/core";
import type { Preset } from "@deeprecall/core";

class DeepRecallDB extends Dexie {
  // Library entities (synced from Electric)
  works!: EntityTable<Work, "id">;
  assets!: EntityTable<Asset, "id">;
  activities!: EntityTable<Activity, "id">;
  collections!: EntityTable<Collection, "id">;
  edges!: EntityTable<Edge, "id">;
  presets!: EntityTable<Preset, "id">;
  authors!: EntityTable<Author, "id">;

  // Local optimistic changes (pending sync)
  presets_local!: EntityTable<
    {
      _localId?: number;
      id: string;
      _op: "insert" | "update" | "delete";
      _status: "pending" | "syncing" | "synced" | "error";
      _timestamp: number;
      _error?: string;
      data?: Preset;
    },
    "_localId"
  >;

  works_local!: EntityTable<
    {
      _localId?: number;
      id: string;
      _op: "insert" | "update" | "delete";
      _status: "pending" | "syncing" | "synced" | "error";
      _timestamp: number;
      _error?: string;
      data?: Work;
    },
    "_localId"
  >;

  assets_local!: EntityTable<
    {
      _localId?: number;
      id: string;
      _op: "insert" | "update" | "delete";
      _status: "pending" | "syncing" | "synced" | "error";
      _timestamp: number;
      _error?: string;
      data?: Asset;
    },
    "_localId"
  >;

  activities_local!: EntityTable<
    {
      _localId?: number;
      id: string;
      _op: "insert" | "update" | "delete";
      _status: "pending" | "syncing" | "synced" | "error";
      _timestamp: number;
      _error?: string;
      data?: Activity;
    },
    "_localId"
  >;

  authors_local!: EntityTable<
    {
      _localId?: number;
      id: string;
      _op: "insert" | "update" | "delete";
      _status: "pending" | "syncing" | "synced" | "error";
      _timestamp: number;
      _error?: string;
      data?: Author;
    },
    "_localId"
  >;

  collections_local!: EntityTable<
    {
      _localId?: number;
      id: string;
      _op: "insert" | "update" | "delete";
      _status: "pending" | "syncing" | "synced" | "error";
      _timestamp: number;
      _error?: string;
      data?: Collection;
    },
    "_localId"
  >;

  edges_local!: EntityTable<
    {
      _localId?: number;
      id: string;
      _op: "insert" | "update" | "delete";
      _status: "pending" | "syncing" | "synced" | "error";
      _timestamp: number;
      _error?: string;
      data?: Edge;
    },
    "_localId"
  >;

  annotations_local!: EntityTable<
    {
      _localId?: number;
      id: string;
      _op: "insert" | "update" | "delete";
      _status: "pending" | "syncing" | "synced" | "error";
      _timestamp: number;
      _error?: string;
      data?: Annotation;
    },
    "_localId"
  >;

  cards_local!: EntityTable<
    {
      _localId?: number;
      id: string;
      _op: "insert" | "update" | "delete";
      _status: "pending" | "syncing" | "synced" | "error";
      _timestamp: number;
      _error?: string;
      data?: Card;
    },
    "_localId"
  >;

  reviewLogs_local!: EntityTable<
    {
      _localId?: number;
      id: string;
      _op: "insert" | "update" | "delete";
      _status: "pending" | "syncing" | "synced" | "error";
      _timestamp: number;
      _error?: string;
      data?: ReviewLog;
    },
    "_localId"
  >;

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
                const parts = fullName.split(",").map((s: string) => s.trim());
                lastName = parts[0] || "";
                firstName = parts[1] || "";
              } else {
                // "First Last" format (or single name)
                const parts = fullName.split(" ").filter((s: string) => s);
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

    // Version 6: Add avatar fields to Authors table
    this.version(6)
      .stores({
        // Add avatar indexes to authors table
        authors:
          "id, lastName, firstName, orcid, affiliation, avatarDisplayPath, createdAt, updatedAt",

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
          "Upgrading database to version 6 (adding avatar fields to Authors)"
        );
        // No data migration needed - new fields are optional
        // Existing authors will have undefined avatar fields
      });

    // Version 7: Migrate title (string) to titles (array)
    this.version(7)
      .stores({
        // Authors table (unchanged indexes)
        authors:
          "id, lastName, firstName, orcid, affiliation, avatarDisplayPath, createdAt, updatedAt",

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
          "Upgrading database to version 7 (migrating title to titles array)"
        );

        const authors = await tx.table("authors").toArray();
        let migrated = 0;

        for (const author of authors) {
          if (author.title && typeof author.title === "string") {
            // Convert single title string to array
            await tx.table("authors").update(author.id, {
              titles: [author.title],
              title: undefined, // Remove old field
            });
            migrated++;
          }
        }

        console.log(
          `✅ Database upgraded to v7: Migrated ${migrated} authors with titles`
        );
      });

    // Version 8: Add local optimistic tables for instant UI feedback
    this.version(8)
      .stores({
        // Authors table (unchanged)
        authors:
          "id, lastName, firstName, orcid, affiliation, avatarDisplayPath, createdAt, updatedAt",

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

        // Local optimistic tables (instant writes, pending sync)
        presets_local: "++_localId, id, _op, _status, _timestamp",

        // Annotations & cards (unchanged)
        annotations:
          "id, sha256, [sha256+page], page, type, createdAt, updatedAt",
        cards: "id, annotation_id, sha256, due, state, created_ms",
        reviewLogs: "id, card_id, review_ms",
      })
      .upgrade(async (tx) => {
        console.log(
          "Upgrading database to version 8 (adding local optimistic tables for two-layer architecture)"
        );
        // No data migration needed - new tables start empty
        // Local changes will be written on next user interaction
        console.log("✅ Database upgraded to v8 - optimistic updates enabled");
      });

    // Version 9: Add works_local table for optimistic Work updates
    this.version(9)
      .stores({
        // Authors table (unchanged)
        authors:
          "id, lastName, firstName, orcid, affiliation, avatarDisplayPath, createdAt, updatedAt",

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

        // Local optimistic tables (instant writes, pending sync)
        presets_local: "++_localId, id, _op, _status, _timestamp",
        works_local: "++_localId, id, _op, _status, _timestamp",

        // Annotations & cards (unchanged)
        annotations:
          "id, sha256, [sha256+page], page, type, createdAt, updatedAt",
        cards: "id, annotation_id, sha256, due, state, created_ms",
        reviewLogs: "id, card_id, review_ms",
      })
      .upgrade(async (tx) => {
        console.log(
          "Upgrading database to version 9 (adding works_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        console.log(
          "✅ Database upgraded to v9 - works optimistic updates enabled"
        );
      });

    // Version 10: Add assets_local table for optimistic Asset updates
    this.version(10)
      .stores({
        // Authors table (unchanged)
        authors:
          "id, lastName, firstName, orcid, affiliation, avatarDisplayPath, createdAt, updatedAt",

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

        // Local optimistic tables (instant writes, pending sync)
        presets_local: "++_localId, id, _op, _status, _timestamp",
        works_local: "++_localId, id, _op, _status, _timestamp",
        assets_local: "++_localId, id, _op, _status, _timestamp",

        // Annotations & cards (unchanged)
        annotations:
          "id, sha256, [sha256+page], page, type, createdAt, updatedAt",
        cards: "id, annotation_id, sha256, due, state, created_ms",
        reviewLogs: "id, card_id, review_ms",
      })
      .upgrade(async (tx) => {
        console.log(
          "Upgrading database to version 10 (adding assets_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        console.log(
          "✅ Database upgraded to v10 - assets optimistic updates enabled"
        );
      });

    // Version 11: Add activities_local table for optimistic Activity updates
    this.version(11)
      .stores({
        // Authors table (unchanged)
        authors:
          "id, lastName, firstName, orcid, affiliation, avatarDisplayPath, createdAt, updatedAt",

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

        // Local optimistic tables (instant writes, pending sync)
        presets_local: "++_localId, id, _op, _status, _timestamp",
        works_local: "++_localId, id, _op, _status, _timestamp",
        assets_local: "++_localId, id, _op, _status, _timestamp",
        activities_local: "++_localId, id, _op, _status, _timestamp",

        // Annotations & cards (unchanged)
        annotations:
          "id, sha256, [sha256+page], page, type, createdAt, updatedAt",
        cards: "id, annotation_id, sha256, due, state, created_ms",
        reviewLogs: "id, card_id, review_ms",
      })
      .upgrade(async (tx) => {
        console.log(
          "Upgrading database to version 11 (adding activities_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        console.log(
          "✅ Database upgraded to v11 - activities optimistic updates enabled"
        );
      });

    // Version 12: Add authors_local table for optimistic Author updates
    this.version(12)
      .stores({
        // Authors table (unchanged)
        authors:
          "id, lastName, firstName, orcid, affiliation, avatarDisplayPath, createdAt, updatedAt",

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

        // Local optimistic tables (instant writes, pending sync)
        presets_local: "++_localId, id, _op, _status, _timestamp",
        works_local: "++_localId, id, _op, _status, _timestamp",
        assets_local: "++_localId, id, _op, _status, _timestamp",
        activities_local: "++_localId, id, _op, _status, _timestamp",
        authors_local: "++_localId, id, _op, _status, _timestamp",

        // Annotations & cards (unchanged)
        annotations:
          "id, sha256, [sha256+page], page, type, createdAt, updatedAt",
        cards: "id, annotation_id, sha256, due, state, created_ms",
        reviewLogs: "id, card_id, review_ms",
      })
      .upgrade(async (tx) => {
        console.log(
          "Upgrading database to version 12 (adding authors_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        console.log(
          "✅ Database upgraded to v12 - authors optimistic updates enabled"
        );
      });

    // Version 13: Add collections_local table for optimistic Collection updates
    this.version(13)
      .stores({
        // Authors table (unchanged)
        authors:
          "id, lastName, firstName, orcid, affiliation, avatarDisplayPath, createdAt, updatedAt",

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

        // Local optimistic tables (instant writes, pending sync)
        presets_local: "++_localId, id, _op, _status, _timestamp",
        works_local: "++_localId, id, _op, _status, _timestamp",
        assets_local: "++_localId, id, _op, _status, _timestamp",
        activities_local: "++_localId, id, _op, _status, _timestamp",
        authors_local: "++_localId, id, _op, _status, _timestamp",
        collections_local: "++_localId, id, _op, _status, _timestamp",

        // Annotations & cards (unchanged)
        annotations:
          "id, sha256, [sha256+page], page, type, createdAt, updatedAt",
        cards: "id, annotation_id, sha256, due, state, created_ms",
        reviewLogs: "id, card_id, review_ms",
      })
      .upgrade(async (tx) => {
        console.log(
          "Upgrading database to version 13 (adding collections_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        console.log(
          "✅ Database upgraded to v13 - collections optimistic updates enabled"
        );
      });

    // Version 14: Add edges_local table for optimistic Edge updates
    this.version(14)
      .stores({
        // Authors table (unchanged)
        authors:
          "id, lastName, firstName, orcid, affiliation, avatarDisplayPath, createdAt, updatedAt",

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

        // Local optimistic tables (instant writes, pending sync)
        presets_local: "++_localId, id, _op, _status, _timestamp",
        works_local: "++_localId, id, _op, _status, _timestamp",
        assets_local: "++_localId, id, _op, _status, _timestamp",
        activities_local: "++_localId, id, _op, _status, _timestamp",
        authors_local: "++_localId, id, _op, _status, _timestamp",
        collections_local: "++_localId, id, _op, _status, _timestamp",
        edges_local: "++_localId, id, _op, _status, _timestamp",

        // Annotations & cards (unchanged)
        annotations:
          "id, sha256, [sha256+page], page, type, createdAt, updatedAt",
        cards: "id, annotation_id, sha256, due, state, created_ms",
        reviewLogs: "id, card_id, review_ms",
      })
      .upgrade(async (tx) => {
        console.log(
          "Upgrading database to version 14 (adding edges_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        console.log(
          "✅ Database upgraded to v14 - edges optimistic updates enabled"
        );
      });

    // Version 15: Add annotations_local table for optimistic Annotation updates
    this.version(15)
      .stores({
        // Authors table (unchanged)
        authors:
          "id, lastName, firstName, orcid, affiliation, avatarDisplayPath, createdAt, updatedAt",

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

        // Local optimistic tables (instant writes, pending sync)
        presets_local: "++_localId, id, _op, _status, _timestamp",
        works_local: "++_localId, id, _op, _status, _timestamp",
        assets_local: "++_localId, id, _op, _status, _timestamp",
        activities_local: "++_localId, id, _op, _status, _timestamp",
        authors_local: "++_localId, id, _op, _status, _timestamp",
        collections_local: "++_localId, id, _op, _status, _timestamp",
        edges_local: "++_localId, id, _op, _status, _timestamp",
        annotations_local: "++_localId, id, _op, _status, _timestamp",

        // Annotations & cards (unchanged)
        annotations:
          "id, sha256, [sha256+page], page, type, createdAt, updatedAt",
        cards: "id, annotation_id, sha256, due, state, created_ms",
        reviewLogs: "id, card_id, review_ms",
      })
      .upgrade(async (tx) => {
        console.log(
          "Upgrading database to version 15 (adding annotations_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        console.log(
          "✅ Database upgraded to v15 - annotations optimistic updates enabled"
        );
      });

    // Version 16: Add cards_local table for optimistic Card updates
    this.version(16)
      .stores({
        // Authors table (unchanged)
        authors:
          "id, lastName, firstName, orcid, affiliation, avatarDisplayPath, createdAt, updatedAt",

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

        // Local optimistic tables (instant writes, pending sync)
        presets_local: "++_localId, id, _op, _status, _timestamp",
        works_local: "++_localId, id, _op, _status, _timestamp",
        assets_local: "++_localId, id, _op, _status, _timestamp",
        activities_local: "++_localId, id, _op, _status, _timestamp",
        authors_local: "++_localId, id, _op, _status, _timestamp",
        collections_local: "++_localId, id, _op, _status, _timestamp",
        edges_local: "++_localId, id, _op, _status, _timestamp",
        annotations_local: "++_localId, id, _op, _status, _timestamp",
        cards_local: "++_localId, id, _op, _status, _timestamp",

        // Annotations & cards (unchanged)
        annotations:
          "id, sha256, [sha256+page], page, type, createdAt, updatedAt",
        cards: "id, annotation_id, sha256, due, state, created_ms",
        reviewLogs: "id, card_id, review_ms",
      })
      .upgrade(async (tx) => {
        console.log(
          "Upgrading database to version 16 (adding cards_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        console.log(
          "✅ Database upgraded to v16 - cards optimistic updates enabled"
        );
      });

    // Version 17: Add reviewLogs_local table for optimistic ReviewLog updates
    this.version(17)
      .stores({
        // Authors table (unchanged)
        authors:
          "id, lastName, firstName, orcid, affiliation, avatarDisplayPath, createdAt, updatedAt",

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

        // Local optimistic tables (instant writes, pending sync)
        presets_local: "++_localId, id, _op, _status, _timestamp",
        works_local: "++_localId, id, _op, _status, _timestamp",
        assets_local: "++_localId, id, _op, _status, _timestamp",
        activities_local: "++_localId, id, _op, _status, _timestamp",
        authors_local: "++_localId, id, _op, _status, _timestamp",
        collections_local: "++_localId, id, _op, _status, _timestamp",
        edges_local: "++_localId, id, _op, _status, _timestamp",
        annotations_local: "++_localId, id, _op, _status, _timestamp",
        cards_local: "++_localId, id, _op, _status, _timestamp",
        reviewLogs_local: "++_localId, id, _op, _status, _timestamp",

        // Annotations & cards (unchanged)
        annotations:
          "id, sha256, [sha256+page], page, type, createdAt, updatedAt",
        cards: "id, annotation_id, sha256, due, state, created_ms",
        reviewLogs: "id, card_id, review_ms",
      })
      .upgrade(async (tx) => {
        console.log(
          "Upgrading database to version 17 (adding reviewLogs_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        console.log(
          "✅ Database upgraded to v17 - reviewLogs optimistic updates enabled"
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
