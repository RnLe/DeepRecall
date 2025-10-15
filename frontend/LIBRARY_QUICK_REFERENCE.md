# Library Schema Quick Reference

Quick lookup for common operations and patterns.

## Import Paths

```typescript
// Schemas & types
import {
  Work,
  Version,
  Asset,
  Activity,
  Collection,
} from "@/src/schema/library";

// Repositories
import * as workRepo from "@/src/repo/works";
import * as versionRepo from "@/src/repo/versions";
import * as assetRepo from "@/src/repo/assets";
import * as activityRepo from "@/src/repo/activities";
import * as collectionRepo from "@/src/repo/collections";
import * as edgeRepo from "@/src/repo/edges";

// React hooks
import { useWorksExtended, useCreateWork } from "@/src/hooks/useLibrary";

// Utilities
import { formatFileSize, getCitationString } from "@/src/utils/library";
```

## Common Patterns

### Create a Work

```typescript
const work = await workRepo.createWork({
  kind: "work",
  title: "Book Title",
  authors: [{ name: "Author Name" }],
  workType: "textbook",
  topics: ["physics"],
  favorite: false,
});
```

### Create a Version

```typescript
const version = await versionRepo.createVersion({
  kind: "version",
  workId: work.id,
  edition: "3rd",
  year: 2018,
  publisher: "Publisher Name",
  favorite: false,
});
```

### Create an Asset

```typescript
const asset = await assetRepo.createAsset({
  kind: "asset",
  versionId: version.id,
  sha256: "abc123...", // From server scan
  filename: "file.pdf",
  bytes: 1048576,
  mime: "application/pdf",
  role: "main",
});
```

### Query with React Hooks

```typescript
function MyComponent() {
  const works = useWorksExtended();        // Live query
  const createWork = useCreateWork();      // Mutation

  if (!works) return <div>Loading...</div>;

  return (
    <div>
      {works.map(work => (
        <div key={work.id}>{work.title}</div>
      ))}
      <button onClick={() => createWork.mutateAsync({ ... })}>
        Add Work
      </button>
    </div>
  );
}
```

### Add to Collection

```typescript
await edgeRepo.addToCollection(collectionId, workId, 0); // order = 0
```

### Create a Course

```typescript
const course = await activityRepo.createActivity({
  kind: "activity",
  activityType: "course",
  title: "Physics 101",
  startsAt: "2025-09-01T00:00:00Z",
  endsAt: "2025-12-31T23:59:59Z",
  participants: [{ name: "Prof. Smith" }],
});
```

## Entity Cheat Sheet

| Entity     | Key Fields                           | FK Fields           |
| ---------- | ------------------------------------ | ------------------- |
| Work       | title, authors, workType, topics     | -                   |
| Version    | edition, year, publisher, journal    | workId → Work       |
| Asset      | sha256, filename, bytes, mime        | versionId → Version |
| Activity   | activityType, title, startsAt/endsAt | -                   |
| Collection | name, ordered, isPrivate             | -                   |
| Edge       | fromId, toId, relation, order        | -                   |

## Relation Types

| Relation     | Usage                                 |
| ------------ | ------------------------------------- |
| contains     | Collection → Work, Activity → Version |
| assignedIn   | Work/Version assigned in Activity     |
| partOf       | Asset partOf Version                  |
| cites        | Work/Version cites Work/Version       |
| prerequisite | Work A prerequisite for Work B        |
| relatedTo    | Generic link                          |
| references   | Generic reference                     |

## Repository Functions

### Works

- `createWork(data)` - Create new work
- `getWork(id)` - Get by ID
- `getWorkExtended(id)` - Get with versions + assets
- `listWorks()` - All works
- `listWorksExtended()` - All works with relations
- `updateWork(id, updates)` - Update work
- `deleteWork(id)` - Delete work + cascading
- `toggleWorkFavorite(id)` - Toggle favorite

### Versions

- `createVersion(data)` - Create new version
- `getVersion(id)` - Get by ID
- `getVersionExtended(id)` - Get with work + assets
- `listVersionsForWork(workId)` - Versions for work
- `updateVersion(id, updates)` - Update version
- `deleteVersion(id)` - Delete version + cascading
- `markVersionAsRead(id)` - Mark as read
- `toggleVersionFavorite(id)` - Toggle favorite

### Assets

- `createAsset(data)` - Create new asset
- `getAsset(id)` - Get by ID
- `getAssetExtended(id)` - Get with version + work
- `getAssetByHash(sha256)` - Get by hash
- `listAssetsForVersion(versionId)` - Assets for version
- `listAssetsForWork(workId)` - Assets for work
- `updateAsset(id, updates)` - Update asset
- `deleteAsset(id)` - Delete asset

### Activities

- `createActivity(data)` - Create new activity
- `getActivity(id)` - Get by ID
- `getActivityExtended(id)` - Get with contained entities
- `listActivities()` - All activities
- `listActivitiesByType(type)` - By type
- `listActiveActivities()` - Currently active
- `listUpcomingActivities()` - Future activities

### Collections

- `createCollection(data)` - Create new collection
- `getCollection(id)` - Get by ID
- `getCollectionExtended(id)` - Get with contained entities
- `listCollections()` - All collections
- `searchCollectionsByName(query)` - Search by name

### Edges

- `createEdge(fromId, toId, relation, options?)` - Create edge
- `getOutgoingEdges(fromId)` - Edges from entity
- `getIncomingEdges(toId)` - Edges to entity
- `deleteEdge(id)` - Delete edge
- `addToCollection(collectionId, entityId, order?)` - Add to collection
- `addToActivity(activityId, entityId, order?)` - Add to activity

## React Hooks

### Works

- `useWorks()` - All works (live)
- `useWorksExtended()` - All works with relations (live)
- `useWork(id)` - Single work (live)
- `useWorkExtended(id)` - Single work with relations (live)
- `useCreateWork()` - Create mutation
- `useUpdateWork()` - Update mutation
- `useDeleteWork()` - Delete mutation

### Versions

- `useVersionsForWork(workId)` - Versions for work (live)
- `useVersion(id)` - Single version (live)
- `useVersionExtended(id)` - Single version with relations (live)
- `useCreateVersion()` - Create mutation
- `useUpdateVersion()` - Update mutation
- `useMarkVersionAsRead()` - Mark as read mutation

### Assets

- `useAssetsForVersion(versionId)` - Assets for version (live)
- `useAssetByHash(sha256)` - Asset by hash (live)
- `useCreateAsset()` - Create mutation

### Activities

- `useActivities()` - All activities (live)
- `useActivity(id)` - Single activity (live)
- `useActiveActivities()` - Active activities (live)
- `useCreateActivity()` - Create mutation

### Collections

- `useCollections()` - All collections (live)
- `useCollection(id)` - Single collection (live)
- `useCollectionExtended(id)` - Collection with relations (live)
- `useCreateCollection()` - Create mutation

## Utility Functions

```typescript
// Display
getEntityDisplayName(entity)     // Get display name
getEntityTypeLabel(entity)       // Get type label
getPrimaryAuthors(work, max?)    // Format authors
getCitationString(work)          // Citation format

// Version
getVersionFullName(version)      // Full version name
getPublicationInfo(version)      // Publication info

// Asset
formatFileSize(bytes)            // "1.5 MB"
getFileExtension(filename)       // "pdf"
isPDF(asset)                     // boolean
getAssetFullName(asset)          // Full asset name

// Activity
isActivityActive(activity)       // Is active now?
isActivityUpcoming(activity)     // Is upcoming?
getActivityDuration(activity)    // Duration in days
formatActivityDateRange(activity)// Date range string

// Collection
getCollectionItemCount(collection) // Item count

// Sorting
compareWorksByTitle(a, b)        // Title comparator
compareWorksByDate(a, b)         // Date comparator
compareVersionsByYear(a, b)      // Year comparator
```

## Type Guards

```typescript
import { isWork, isVersion, isAsset } from "@/src/schema/library";

if (isWork(entity)) {
  console.log(entity.title); // TypeScript knows it's Work
}
```

## Validation

```typescript
import { WorkSchema } from "@/src/schema/library";

// Parse (throws on error)
const work = WorkSchema.parse(data);

// Safe parse (returns result)
const result = WorkSchema.safeParse(data);
if (result.success) {
  const work = result.data;
} else {
  console.error(result.error);
}
```

---

For full documentation, see `LIBRARY_SCHEMA.md`.
