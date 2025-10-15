The pitch is crisp and the mental guardrails are already set: server owns bytes-by-hash, the browser owns knowledge, and UI state stays ephemeral. That split argues for keeping literature metadata local (Dexie) with runtime-validated schemas (Zod) that also generate your TS types—so you get strong typing without duplicating interfaces by hand. That’s the least entangled path and fits the “one source of truth per boundary” rule you wrote down.

Pitch

MentalModels

Below is a concrete, scalable structure that matches your “Literature ⇄ Version ⇄ Files” idea, adds a clean layer for “Courses/Projects” (your rich aggregates), and keeps “Collections” as shallow groupers. I’ll give names, pros/cons, and code you can drop in now.

Big picture model (simple, but future-proof)

Think of nodes + edges with a few first-class node kinds:

Work — the abstract intellectual identity (book/paper/notes “as a work”).

Version — a concrete edition/revision/issue tied to a publication event.

Asset — an actual file or file-part bound to a blob hash (PDF, slides PDF, ZIP, etc.).

Activity — the rich aggregate: course, workshop, project, thesis module… (has its own metadata: time window, participants, institution).

Collection — a shallow named grouping (curation; optional ordering), e.g. “Winter Semester 2026”, “Photonic Research”.

And one generic Edge table to connect them: contains, assignedIn, cites, partOf, etc.

This keeps your original “Literature + Versions” intact, adds a principled aggregate (Activity), and reserves Collections for curation. It also avoids painting you into a corner when something wants to link across lanes (e.g., “this paper was assigned in Course X” and “is in the ‘Quantum Mechanics’ collection”).

Why this shape works here

Matches your server/client split: blobs live server-side; Assets reference blob sha256; everything else (Work/Version/Activity/Collection/Edges) lives locally in Dexie (exportable as JSON).

Pitch

Strong typing with Zod first; export z.infer<…> types so React gets clean intellisense without duplicating interfaces.

MentalModels

Activities carry richer metadata than Collections (participants, schedule), solving your “course ≠ collection” tension.

Edges mean you don’t need ad-hoc “container” fields everywhere; queries remain simple.

Naming, briefly

Keep your terms but tighten them:

Work (your “Literature”)

Version (edition/issue/revision; what you called “Version”)

Asset (file reference; replaces any “File”/“BlobRef” confusion)

Activity (supertype; Course | Workshop | Project | Thesis | Seminar via a activityType union)

Collection (curation bucket)

That’s clear in the UI and maps cleanly to library science (FRBR-ish) without importing the whole FRBR stack.

Minimal Zod schemas (single source of truth) + inferred TS types

Put this in /src/schema/library.ts.
Keep your existing schema/annotations.ts separate; this file is only the “library”.

// /src/schema/library.ts
import { z } from "zod";

/\*_ Shared primitives _/
export const Id = z.string().uuid(); // Use uuid for local entities
export const ISODate = z.string().datetime(); // ISO 8601
const Year = z.number().int().min(0).max(3000);

/\*_ Person (very light; expand later) _/
export const PersonSchema = z.object({
name: z.string(),
orcid: z.string().url().optional(),
});
export type Person = z.infer<typeof PersonSchema>;

/\*_ Work = abstract identity of a book/paper/notes _/
export const WorkSchema = z.object({
id: Id,
kind: z.literal("work"),
title: z.string(),
subtitle: z.string().optional(),
authors: z.array(PersonSchema).default([]),
// For papers/books:
workType: z.enum(["paper", "textbook", "thesis", "notes", "slides", "dataset", "other"]).default("paper"),
topics: z.array(z.string()).default([]), // tags/keywords at the Work level
createdAt: ISODate,
updatedAt: ISODate,
});
export type Work = z.infer<typeof WorkSchema>;

/\*_ Version = concrete edition/issue tied to publication event _/
export const VersionSchema = z.object({
id: Id,
kind: z.literal("version"),
workId: Id, // FK → Work
edition: z.string().optional(), // "3rd", "v2", "rev. 2021"
year: Year.optional(),
publisher: z.string().optional(),
journal: z.string().optional(),
volume: z.string().optional(),
issue: z.string().optional(),
pages: z.string().optional(), // "123-147"
doi: z.string().optional(),
arxivId: z.string().optional(),
notes: z.string().optional(),
createdAt: ISODate,
updatedAt: ISODate,
});
export type Version = z.infer<typeof VersionSchema>;

/\*_ Asset = concrete file bound to CAS blob by sha256 _/
export const AssetSchema = z.object({
id: Id,
kind: z.literal("asset"),
versionId: Id, // FK → Version
sha256: z.string(), // joins to server /blob/:sha256
filename: z.string(),
bytes: z.number().int().min(0),
mime: z.string(),
pageCount: z.number().int().min(1).optional(),
role: z.enum(["main", "supplement", "slides", "solutions", "data"]).default("main"),
partIndex: z.number().int().min(0).optional(), // for multi-part scripts
createdAt: ISODate,
updatedAt: ISODate,
});
export type Asset = z.infer<typeof AssetSchema>;

/\*_ Activity = rich aggregate like Course/Project with real metadata _/
export const ActivitySchema = z.object({
id: Id,
kind: z.literal("activity"),
activityType: z.enum(["course", "workshop", "project", "thesis", "seminar"]),
title: z.string(),
institution: z.string().optional(),
participants: z.array(PersonSchema).default([]),
startsAt: ISODate.optional(),
endsAt: ISODate.optional(),
description: z.string().optional(),
createdAt: ISODate,
updatedAt: ISODate,
});
export type Activity = z.infer<typeof ActivitySchema>;

/\*_ Collection = shallow curated set (optionally ordered) _/
export const CollectionSchema = z.object({
id: Id,
kind: z.literal("collection"),
name: z.string(),
description: z.string().optional(),
ordered: z.boolean().default(false),
createdAt: ISODate,
updatedAt: ISODate,
});
export type Collection = z.infer<typeof CollectionSchema>;

/\*_ Edges connect anything-to-anything with a typed relation _/
export const RelationSchema = z.enum([
"contains", // A contains B (Collection→Work, Activity→Version, Version→Asset)
"assignedIn", // Work/Version assigned in Activity
"partOf", // Asset partOf Version, Version partOf Activity module, etc.
"cites", // Work/Version cites Work/Version
"relatedTo", // loose link
]);
export type Relation = z.infer<typeof RelationSchema>;

export const EdgeSchema = z.object({
id: Id,
fromId: Id,
toId: Id,
relation: RelationSchema,
createdAt: ISODate,
});
export type Edge = z.infer<typeof EdgeSchema>;

How this answers your cases

Textbook with editions: Work(textbook) → Version(edition, year, publisher) → Asset(PDF).

Paper: Work(paper) → Version(journal or arXiv) → Asset(PDF).

Multi-part script + 14 sheets + slides: one Activity(course), then edges:

Activity contains Version(script-v1)

Version(script-v1) contains Asset(part-0..N)

Activity contains Version(sheet-1..14) and each contains its Asset

Activity contains Version(slides) → Asset(slides)

Collections like “Summer Semester 2026” just contains Works/Versions/Activities without inventing extra metadata.

Pros

Flexible without making the UI vague.

Queryable in both tree and graph ways (e.g., “show all Assets assigned in this course”).

Keeps blobs on the server, metadata local, exactly as in your pitch.

Pitch

Cons

You’ll maintain an edges table; but it pays for itself the first time a thing belongs in two places.

Where do the “supported fields” live?

Make the UI’s “supported field” list explicit and typed, instead of sprinkling optional fields in components. A small registry tells the UI what a field is and how to render it.

// /src/schema/fieldRegistry.ts
export type FieldKey =
| "title" | "subtitle" | "authors"
| "year" | "publisher" | "journal" | "volume" | "issue" | "pages"
| "doi" | "arxivId";

export interface FieldDescriptor {
key: FieldKey;
label: string;
entity: "work" | "version";
input: "text" | "long
