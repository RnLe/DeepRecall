# Library Schema Documentation

This document explains the library schema structure for DeepRecall, which replaces the old Strapi-based system with a clean, local-first architecture.

## Architecture Overview

The library schema follows the **Work → Version → Asset** hierarchy described in `LiteratureStructure.md`:

- **Work**: Abstract intellectual identity (book/paper as a "work")
- **Version**: Concrete edition/revision tied to a publication event
- **Asset**: Actual file bound to a blob hash (sha256)
- **Activity**: Rich aggregate for courses, projects, workshops
- **Collection**: Shallow grouping for curation
- **Edge**: Typed relation connecting entities

## Key Differences from Old System

### What Changed

| Old (Strapi)                    | New (Local-first)                 |
| ------------------------------- | --------------------------------- |
| `Literature`                    | `Work`                            |
| `Version` (nested in metadata)  | `Version` (first-class entity)    |
| `documentId` (Strapi-generated) | `id` (UUID, client-generated)     |
| Metadata as JSON string         | Structured fields + optional JSON |
| `StrapiResponse` base type      | No base type (clean interfaces)   |
| Server-side storage             | Local Dexie (IndexedDB)           |
| Collections in metadata array   | Collections via `Edge` table      |

### What Stayed the Same

- **Work metadata**: title, authors, subtitle, workType, topics
- **Version metadata**: year, edition, publisher, journal, DOI, arXiv ID
- **File metadata**: filename, size, MIME type
- **User flags**: favorite, read status

## Entity Schemas

### Work

```typescript
{
  id: string;              // UUID
  kind: "work";
  title: string;
  subtitle?: string;
  authors: Person[];       // { name, orcid?, affiliation? }
  workType: WorkType;      // "paper" | "textbook" | "thesis" | ...
  topics: string[];        // Tags/keywords
  icon?: string;           // Lucide icon name
  color?: string;          // Hex color
  favorite: boolean;
  createdAt: string;       // ISO 8601
  updatedAt: string;
}
```

### Version

```typescript
{
  id: string;
  kind: "version";
  workId: string;          // FK → Work
  edition?: string;        // "3rd", "v2", "rev. 2021"
  versionNumber?: number;
  year?: number;
  publishingDate?: string; // ISO 8601 (full date if known)
  publisher?: string;
  journal?: string;        // For papers
  volume?: string;
  issue?: string;
  pages?: string;          // "123-147"
  doi?: string;
  arxivId?: string;
  isbn?: string;
  versionTitle?: string;   // Optional title override
  notes?: string;
  read?: string;           // ISO 8601 (when marked as read)
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Asset

```typescript
{
  id: string;
  kind: "asset";
  versionId: string;       // FK → Version
  sha256: string;          // Join key to server CAS
  filename: string;
  bytes: number;
  mime: string;
  pageCount?: number;      // PDF-specific
  role: AssetRole;         // "main" | "supplement" | "slides" | ...
  partIndex?: number;      // For multi-part assets
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Activity

```typescript
{
  id: string;
  kind: "activity";
  activityType: ActivityType; // "course" | "workshop" | "project" | ...
  title: string;
  description?: string;
  institution?: string;
  participants: Person[];
  startsAt?: string;       // ISO 8601
  endsAt?: string;
  icon?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Collection

```typescript
{
  id: string;
  kind: "collection";
  name: string;
  description?: string;
  ordered: boolean;        // Whether order matters
  icon?: string;
  color?: string;
  isPrivate: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
```

### Edge

```typescript
{
  id: string;
  fromId: string;          // Source entity ID
  toId: string;            // Target entity ID
  relation: Relation;      // "contains" | "assignedIn" | "partOf" | "cites" | ...
  order?: number;          // For ordered relations
  metadata?: string;       // Optional JSON metadata
  createdAt: string;
}
```

## Usage Examples

### Creating a Work with Versions and Assets

```typescript
import { createWork } from "@/src/repo/works";
import { createVersion } from "@/src/repo/versions";
import { createAsset } from "@/src/repo/assets";

// 1. Create the Work
const work = await createWork({
  kind: "work",
  title: "Introduction to Quantum Mechanics",
  authors: [{ name: "David J. Griffiths" }],
  workType: "textbook",
  topics: ["quantum mechanics", "physics"],
  favorite: false,
});

// 2. Create a Version
const version = await createVersion({
  kind: "version",
  workId: work.id,
  edition: "3rd",
  year: 2018,
  publisher: "Cambridge University Press",
  isbn: "978-1107189638",
  favorite: false,
});

// 3. Create an Asset (linked to server blob)
const asset = await createAsset({
  kind: "asset",
  versionId: version.id,
  sha256: "abc123...", // From server scan
  filename: "griffiths-qm-3rd.pdf",
  bytes: 15728640,
  mime: "application/pdf",
  pageCount: 468,
  role: "main",
});
```

### Using React Hooks

```typescript
import { useWorksExtended, useCreateWork } from "@/src/hooks/useLibrary";

function LibraryPage() {
  // Live query (auto-updates on DB changes)
  const works = useWorksExtended();

  const createWork = useCreateWork();

  const handleCreate = async () => {
    await createWork.mutateAsync({
      kind: "work",
      title: "New Work",
      authors: [],
      workType: "paper",
      topics: [],
      favorite: false,
    });
  };

  return (
    <div>
      {works?.map((work) => (
        <div key={work.id}>
          <h2>{work.title}</h2>
          <p>{work.versions?.length || 0} versions</p>
        </div>
      ))}
    </div>
  );
}
```

### Managing Collections

```typescript
import { createCollection } from "@/src/repo/collections";
import { addToCollection } from "@/src/repo/edges";

// Create a collection
const collection = await createCollection({
  kind: "collection",
  name: "Quantum Physics Reading List",
  description: "Essential texts for graduate study",
  ordered: true,
  isPrivate: false,
  tags: ["physics", "quantum"],
});

// Add works to the collection (via edges)
await addToCollection(collection.id, work1.id, 0); // order = 0
await addToCollection(collection.id, work2.id, 1); // order = 1
```

### Managing Activities

```typescript
import { createActivity } from "@/src/repo/activities";
import { addToActivity } from "@/src/repo/edges";

// Create a course
const course = await createActivity({
  kind: "activity",
  activityType: "course",
  title: "Physics 101",
  institution: "University",
  startsAt: "2025-09-01T00:00:00Z",
  endsAt: "2025-12-31T23:59:59Z",
  participants: [{ name: "Prof. Smith" }, { name: "Dr. Jones" }],
});

// Assign works to the course
await addToActivity(course.id, work1.id);
await addToActivity(course.id, work2.id);
```

## Migration from Old System

### Field Mappings

| Old Field                        | New Field                       |
| -------------------------------- | ------------------------------- |
| `Literature.title`               | `Work.title`                    |
| `Literature.type`                | `Work.workType`                 |
| `Literature.metadata` (JSON)     | Structured `Work` fields        |
| `Version.name`                   | `Version.edition`               |
| `Version.versionMetadata` (JSON) | Structured `Version` fields     |
| `Version.fileUrl`                | `Asset.sha256` (join to server) |
| `Collection.literatureIds`       | `Edge` (relation: "contains")   |

### Code Patterns

**Old (Strapi):**

```typescript
// Nested versions in metadata
const literature = {
  title: "...",
  metadata: JSON.stringify({
    versions: [...],
  }),
};
```

**New (Local-first):**

```typescript
// First-class entities
const work = { id: "...", title: "..." };
const version = { id: "...", workId: work.id };
const asset = { id: "...", versionId: version.id, sha256: "..." };
```

## Validation

All schemas use **Zod** for runtime validation:

```typescript
import { WorkSchema } from "@/src/schema/library";

// Parse (throws on invalid)
const work = WorkSchema.parse(data);

// Safe parse (returns error on invalid)
const result = WorkSchema.safeParse(data);
if (result.success) {
  const work = result.data;
} else {
  console.error(result.error);
}
```

## Type Guards

```typescript
import { isWork, isVersion, isAsset } from "@/src/schema/library";

function handleEntity(entity: LibraryEntity) {
  if (isWork(entity)) {
    console.log(entity.title); // TypeScript knows it's a Work
  } else if (isVersion(entity)) {
    console.log(entity.year); // TypeScript knows it's a Version
  }
}
```

## Best Practices

1. **Always use repositories** for DB operations (don't access Dexie directly)
2. **Use React hooks** for queries (auto-updates via `useLiveQuery`)
3. **Validate at boundaries** (API inputs, file imports)
4. **Use UUIDs for IDs** (client-generated, deterministic where needed)
5. **Keep blobs on server** (only metadata in Dexie)
6. **Use edges for relations** (avoid ad-hoc arrays of IDs)

## Storage Layout

- **Server (SQLite)**: `blobs` (hash, size, mime, ...), `paths` (hash, path)
- **Client (Dexie)**: `works`, `versions`, `assets`, `activities`, `collections`, `edges`

The `Asset.sha256` field is the **join key** between client (Dexie) and server (SQLite).
