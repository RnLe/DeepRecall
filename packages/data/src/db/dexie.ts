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
import type {
  Preset,
  BlobMeta,
  DeviceBlob,
  ReplicationJob,
  Board,
  Stroke,
} from "@deeprecall/core";
import { logger } from "@deeprecall/telemetry";

class DeepRecallDB extends Dexie {
  // Library entities (synced from Electric)
  works!: EntityTable<Work, "id">;
  assets!: EntityTable<Asset, "id">;
  activities!: EntityTable<Activity, "id">;
  collections!: EntityTable<Collection, "id">;
  edges!: EntityTable<Edge, "id">;
  presets!: EntityTable<Preset, "id">;
  authors!: EntityTable<Author, "id">;

  // Blob coordination (synced from Electric)
  blobsMeta!: EntityTable<BlobMeta, "sha256">;
  deviceBlobs!: EntityTable<DeviceBlob, "id">;
  replicationJobs!: EntityTable<ReplicationJob, "id">;

  // Boards and strokes (synced from Electric)
  boards!: EntityTable<Board, "id">;
  strokes!: EntityTable<Stroke, "id">;

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

  boards_local!: EntityTable<
    {
      _localId?: number;
      id: string;
      _op: "insert" | "update" | "delete";
      _status: "pending" | "syncing" | "synced" | "error";
      _timestamp: number;
      _error?: string;
      data?: Board;
    },
    "_localId"
  >;

  strokes_local!: EntityTable<
    {
      _localId?: number;
      id: string;
      _op: "insert" | "update" | "delete";
      _status: "pending" | "syncing" | "synced" | "error";
      _timestamp: number;
      _error?: string;
      data?: Stroke;
    },
    "_localId"
  >;

  // Annotations & cards
  annotations!: EntityTable<Annotation, "id">;
  cards!: EntityTable<Card, "id">;
  reviewLogs!: EntityTable<ReviewLog, "id">;

  constructor(dbName?: string) {
    super(dbName || "DeepRecallDB");
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
        logger.info(
          "db.local",
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
        logger.info(
          "db.local",
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

        logger.info(
          "db.local",
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
        logger.info(
          "db.local",
          "Upgrading database to version 4 (adding annotation attachment support)"
        );

        // No data migration needed - new fields are optional
        // Existing annotations without attachedAssets are valid
        // Existing assets without purpose/annotationId are valid

        logger.info(
          "db.local",
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
        logger.info(
          "db.local",
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

        logger.info(
          "db.local",
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
        logger.info(
          "db.local",
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
        logger.info(
          "db.local",
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

        logger.info(
          "db.local",
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
        logger.info(
          "db.local",
          "Upgrading database to version 8 (adding local optimistic tables for two-layer architecture)"
        );
        // No data migration needed - new tables start empty
        // Local changes will be written on next user interaction
        logger.info(
          "db.local",
          "✅ Database upgraded to v8 - optimistic updates enabled"
        );
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
        logger.info(
          "db.local",
          "Upgrading database to version 9 (adding works_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        logger.info(
          "db.local",
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
        logger.info(
          "db.local",
          "Upgrading database to version 10 (adding assets_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        logger.info(
          "db.local",
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
        logger.info(
          "db.local",
          "Upgrading database to version 11 (adding activities_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        logger.info(
          "db.local",
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
        logger.info(
          "db.local",
          "Upgrading database to version 12 (adding authors_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        logger.info(
          "db.local",
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
        logger.info(
          "db.local",
          "Upgrading database to version 13 (adding collections_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        logger.info(
          "db.local",
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
        logger.info(
          "db.local",
          "Upgrading database to version 14 (adding edges_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        logger.info(
          "db.local",
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
        logger.info(
          "db.local",
          "Upgrading database to version 15 (adding annotations_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        logger.info(
          "db.local",
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
        logger.info(
          "db.local",
          "Upgrading database to version 16 (adding cards_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        logger.info(
          "db.local",
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
        logger.info(
          "db.local",
          "Upgrading database to version 17 (adding reviewLogs_local table for optimistic updates)"
        );
        // No data migration needed - new table starts empty
        logger.info(
          "db.local",
          "✅ Database upgraded to v17 - reviewLogs optimistic updates enabled"
        );
      });

    // Version 18: Add blobsMeta and deviceBlobs tables for blob coordination
    this.version(18)
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

        // Blob coordination (synced from Electric)
        blobsMeta: "sha256, mime, createdAt",
        deviceBlobs: "id, deviceId, sha256, present, health, createdAt",
        replicationJobs:
          "id, sha256, targetDeviceId, status, priority, createdAt",

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
        logger.info(
          "db.local",
          "Upgrading database to version 18 (adding blobsMeta and deviceBlobs tables)"
        );
        // No data migration needed - new tables start empty
        logger.info(
          "db.local",
          "✅ Database upgraded to v18 - blob coordination tables enabled"
        );
      });

    // Version 19: Add boards and strokes tables for note-taking canvas
    this.version(19)
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

        // Blob coordination (unchanged)
        blobsMeta: "sha256, mime, createdAt",
        deviceBlobs: "id, deviceId, sha256, present, health, createdAt",
        replicationJobs:
          "id, sha256, targetDeviceId, status, priority, createdAt",

        // Boards and strokes (new)
        boards: "id, title, createdAt, updatedAt",
        strokes: "id, boardId, createdAt",

        // Local optimistic tables (add boards and strokes)
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
        boards_local: "++_localId, id, _op, _status, _timestamp",
        strokes_local: "++_localId, id, _op, _status, _timestamp",

        // Annotations & cards (unchanged)
        annotations:
          "id, sha256, [sha256+page], page, type, createdAt, updatedAt",
        cards: "id, annotation_id, sha256, due, state, created_ms",
        reviewLogs: "id, card_id, review_ms",
      })
      .upgrade(async (tx) => {
        logger.info(
          "db.local",
          "Upgrading database to version 19 (adding boards and strokes tables)"
        );
        // No data migration needed - new tables start empty
        logger.info(
          "db.local",
          "✅ Database upgraded to v19 - boards and strokes tables enabled"
        );
      });
  }
}

import { getDatabaseName } from "./naming";

// Initialize database with dynamic name based on auth state
// Guest: deeprecall_guest_<deviceId>
// User: deeprecall_<userId>_<deviceId>
export const db = new DeepRecallDB(getDatabaseName());

// Add error handling for database opening
db.on("versionchange", () => {
  logger.warn("db.local", "Database version changed by another tab");
  db.close();
  window.location.reload();
});

/**
 * Clear all Dexie data (both synced and local tables)
 * Use this when Postgres is reset to prevent stale local data
 *
 * @example
 * // In browser console:
 * import { clearAllDexieData } from '@deeprecall/data/db';
 * await clearAllDexieData();
 */
export async function clearAllDexieData(): Promise<void> {
  logger.info("db.local", "[Dexie] Clearing all data...");

  try {
    // Clear all tables
    await Promise.all([
      // Synced tables
      db.works.clear(),
      db.assets.clear(),
      db.activities.clear(),
      db.collections.clear(),
      db.edges.clear(),
      db.presets.clear(),
      db.authors.clear(),
      db.annotations.clear(),
      db.cards.clear(),
      db.reviewLogs.clear(),
      db.blobsMeta.clear(),
      db.deviceBlobs.clear(),
      db.boards.clear(),
      db.strokes.clear(),

      // Local optimistic tables
      db.works_local.clear(),
      db.assets_local.clear(),
      db.activities_local.clear(),
      db.collections_local.clear(),
      db.edges_local.clear(),
      db.presets_local.clear(),
      db.authors_local.clear(),
      db.annotations_local.clear(),
      db.cards_local.clear(),
      db.reviewLogs_local.clear(),
      db.boards_local.clear(),
      db.strokes_local.clear(),
    ]);

    logger.info("db.local", "[Dexie] ✅ All data cleared successfully");
  } catch (error) {
    logger.error("db.local", "[Dexie] Failed to clear data", { error });
    throw error;
  }
}

/**
 * Switch to a different database (guest → user or user → guest)
 *
 * This function closes the current database and returns a new instance
 * with the appropriate name based on the current auth state.
 *
 * Call this after auth state changes (sign in / sign out).
 *
 * @returns New DeepRecallDB instance with updated name
 *
 * @example
 * // After sign in
 * const newDb = await switchDatabase();
 * // Update all Electric shapes with new db instance
 */
export async function switchDatabase(): Promise<DeepRecallDB> {
  const currentName = db.name;
  const newName = getDatabaseName();

  logger.info("db.local", "Switching database", {
    from: currentName,
    to: newName,
  });

  // Close current database
  await db.close();

  // Create new database instance with new name
  const newDb = new DeepRecallDB(newName);

  logger.info("db.local", "Database switched successfully", {
    name: newName,
  });

  return newDb;
}
