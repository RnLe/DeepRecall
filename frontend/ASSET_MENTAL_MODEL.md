# Asset Mental Model - Implementation Guide

## The Problem That Was Fixed

Assets were not disappearing from the "Unlinked Assets" list after being linked to Activities. This was due to a **mental model violation** in the codebase.

## Root Cause

We were using **React Query** (`useQuery`) for Assets, which are **local durable data** stored in Dexie (IndexedDB). According to the mental model:

- **Remote data** → React Query (server files, blobs)
- **Local durable data** → Dexie + useLiveQuery (annotations, cards, **Assets**)
- **UI state** → Zustand (ephemeral state)

React Query doesn't automatically know when Dexie data changes, so even after creating edges to link Assets, the UI didn't update until we manually invalidated queries. This was fragile and violated the single-source-of-truth principle.

## The Fix

Changed `useUnlinkedAssets()` from React Query to `useLiveQuery`:

**Before (incorrect):**

```typescript
export function useUnlinkedAssets() {
  return useQuery({
    queryKey: ["unlinkedAssets"],
    queryFn: getUnlinkedAssets,
    staleTime: 1000 * 60 * 5,
  });
}
```

**After (correct):**

```typescript
export function useUnlinkedAssets() {
  return useLiveQuery(async () => {
    const standaloneAssets = await db.assets
      .filter((asset) => !asset.versionId)
      .toArray();

    const edges = await db.edges.toArray();
    const linkedAssetIds = new Set(
      edges
        .filter((edge) => edge.relation === "contains")
        .map((edge) => edge.toId)
    );

    return standaloneAssets.filter((asset) => !linkedAssetIds.has(asset.id));
  }, []);
}
```

Now the UI **automatically updates** when edges are created or deleted, without manual query invalidations.

---

## Mental Model: Assets vs Blobs

### Blob (Server-side)

- **Location**: Server SQLite database (`blobs` table)
- **Identity**: SHA-256 hash (content-addressed)
- **Nature**: Immutable, raw file storage (CAS)
- **Access**: `/api/library/blobs`, `/api/blob/:hash`
- **Queried via**: React Query (remote data)
- **Examples**: PDFs, images, data files on disk

### Asset (Client-side)

- **Location**: Browser IndexedDB (`assets` table in Dexie)
- **Identity**: UUID (client-generated)
- **Nature**: Mutable metadata entity that _references_ a blob
- **Purpose**: Semantic wrapper around a blob (role, filename, linkage)
- **Queried via**: `useLiveQuery` (local durable data)
- **Lifecycle**: Independent from blob (can outlive connections)

**Key principle**: Multiple Assets can reference the same Blob (same PDF used in different contexts).

---

## Asset Linking States

An Asset can be in one of three states:

### 1. Version-linked

- **Has**: `versionId` field set
- **Meaning**: Part of a Work/Version
- **Hierarchy**: Work → Version → Asset → Blob
- **Use case**: Main textbook PDF, supplementary slides for a specific edition

### 2. Edge-linked (Standalone but connected)

- **Has**: No `versionId`, but has edges with `relation: "contains"`
- **Meaning**: Standalone Asset linked to Activity or Collection
- **Structure**: `Edge { fromId: activityId, toId: assetId, relation: "contains" }`
- **Use case**: Course materials not tied to a specific Work/Version

### 3. Unlinked

- **Has**: No `versionId`, no edges
- **Meaning**: Orphaned Asset that needs linking
- **Shown in**: "Unlinked Assets" section of FileInbox
- **Use case**: Temporary state after Asset creation, before linking

---

## Data Flow: From Upload to Linking

### 1. File Upload/Scan

```
User drops file → Server CAS → Blob created (sha256, size, mime)
```

### 2. Asset Creation (Two paths)

**Path A: Link to Work/Version**

```
User links blob to Work → Asset created with versionId → Version-linked
```

**Path B: Standalone Asset**

```
User drags blob to Activity → Asset created without versionId → Edge created → Edge-linked
```

### 3. Querying Unlinked Assets

```typescript
// Automatically updates when edges change (useLiveQuery)
const unlinkedAssets = await db.assets
  .filter((asset) => !asset.versionId) // Only standalone
  .toArray();

const edges = await db.edges.toArray();
const linkedIds = new Set(
  edges.filter((e) => e.relation === "contains").map((e) => e.toId)
);

return unlinkedAssets.filter((asset) => !linkedIds.has(asset.id));
```

---

## Code Organization

### Files Updated

1. **`src/hooks/useBlobs.ts`**
   - Changed `useUnlinkedAssets` to use `useLiveQuery`
   - Added comprehensive mental model documentation
   - Clarified Blob vs Asset distinction

2. **`src/schema/library.ts`**
   - Added 30+ line comment explaining Asset mental model
   - Documented versionId optionality and linking states

3. **`src/schema/blobs.ts`**
   - Added header comment explaining Blob vs Asset

4. **`src/repo/assets.ts`**
   - Added mental model documentation
   - Explained Asset lifecycle (create, link, unlink, delete)

5. **`src/repo/edges.ts`**
   - Documented how edges link Assets
   - Explained "contains" relation for Activities/Collections

6. **`app/library/page.tsx`**
   - Removed unnecessary `invalidateQueries` for `unlinkedAssets`
   - Added comments explaining why invalidation isn't needed

7. **`app/library/FileInbox.tsx`**
   - Changed from `{ data: unlinkedAssets }` to `unlinkedAssets` (useLiveQuery return)
   - Removed unnecessary invalidations

8. **`app/library/ActivityBanner.tsx`**
   - Added comments explaining drop behavior for blobs vs assets

---

## Testing Checklist

### ✅ Scenarios to Verify

1. **Drag blob to Activity**
   - Asset should be created (standalone, no versionId)
   - Edge should be created (fromId: activity, toId: asset, relation: "contains")
   - Asset should **disappear** from "Unlinked Assets" immediately

2. **Drag unlinked Asset to Activity**
   - Edge should be created
   - Asset should **disappear** from "Unlinked Assets" immediately

3. **Unlink Asset from Activity**
   - Edge should be deleted
   - Asset should **reappear** in "Unlinked Assets" immediately

4. **Link blob to Work/Version**
   - Asset should be created with versionId
   - Asset should **never appear** in "Unlinked Assets" (has versionId)

5. **Create standalone Asset**
   - Asset should appear in "Unlinked Assets" immediately

---

## Common Pitfalls (Avoided)

### ❌ Don't: Mix React Query for local data

```typescript
// WRONG: Assets are in Dexie, not on server
export function useUnlinkedAssets() {
  return useQuery({ queryKey: ["unlinkedAssets"], queryFn: ... });
}
```

### ✅ Do: Use useLiveQuery for Dexie data

```typescript
// CORRECT: Automatically reacts to Dexie changes
export function useUnlinkedAssets() {
  return useLiveQuery(async () => {
    /* query Dexie */
  }, []);
}
```

### ❌ Don't: Manually invalidate queries for local data

```typescript
// WRONG: Fighting against the mental model
await edgeRepo.addToActivity(activityId, assetId);
queryClient.invalidateQueries({ queryKey: ["unlinkedAssets"] }); // Unnecessary!
```

### ✅ Do: Let useLiveQuery handle reactivity

```typescript
// CORRECT: useLiveQuery automatically updates
await edgeRepo.addToActivity(activityId, assetId);
// UI updates automatically, no manual invalidation needed
```

---

## Mental Model Boundaries (Summary)

| Data Type    | Source of Truth | Query Method             | Example                    |
| ------------ | --------------- | ------------------------ | -------------------------- |
| **Blobs**    | Server SQLite   | React Query (`useQuery`) | Files in CAS               |
| **Assets**   | Browser Dexie   | Dexie (`useLiveQuery`)   | File metadata with linkage |
| **Works**    | Browser Dexie   | Dexie (`useLiveQuery`)   | Book/paper entities        |
| **Edges**    | Browser Dexie   | Dexie (`useLiveQuery`)   | Relationships              |
| **UI State** | Zustand         | Store selectors          | Selected tool, page number |

**Golden Rule**: Don't duplicate ownership. Each piece of data has exactly one source of truth.

---

## Future Considerations

1. **Asset garbage collection**: Consider periodic cleanup of unlinked Assets referencing deleted blobs
2. **Bulk operations**: When linking many Assets, edges are created individually (could batch)
3. **Asset versioning**: Currently Assets are immutable after creation (only edges change)
4. **Asset metadata enrichment**: Could extract more metadata from blobs (OCR, indexing)

---

## Related Documentation

- **`MentalModels.md`**: Core mental model document
- **`Pitch.md`**: Project overview and architecture
- **`LIBRARY_SCHEMA.md`**: Detailed schema documentation
- **`LIBRARY_QUICK_REFERENCE.md`**: API quick reference

---

## Conclusion

By applying the mental model consistently:

✅ **Assets** are now properly treated as **local durable data** (Dexie + useLiveQuery)  
✅ **Blobs** remain **remote data** (React Query)  
✅ **UI reactivity** works automatically without manual invalidations  
✅ **Code is simpler** and aligns with the architectural principles

The "Unlinked Assets" bug is fixed, and the codebase is more maintainable going forward.
