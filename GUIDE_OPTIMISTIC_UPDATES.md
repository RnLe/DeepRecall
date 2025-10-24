# Guide: Optimistic Updates with Electric SQL

> **Blueprint for implementing instant UI updates with background sync**
>
> Based on Annotations entity - applies to all entities (Works, Assets, Cards, etc.)

## 🎯 Core Concept

**Problem**: 2-3 second delay from user action → Postgres → Electric → UI update

**Solution**: Two-layer architecture

```
User Action → [INSTANT] Local Dexie → [INSTANT] UI
            ↓ (background)
            WriteBuffer → Postgres → Electric → Cleanup
```

## 📁 File Structure (per entity)

```
packages/data/src/
├── repos/
│   ├── annotations.local.ts      # Instant writes to Dexie + WriteBuffer
│   ├── annotations.electric.ts   # Electric shapes (background sync)
│   ├── annotations.merged.ts     # Merge synced + local data
│   └── annotations.cleanup.ts    # Remove local after sync confirmation
└── hooks/
    └── useAnnotations.ts          # React hooks returning merged data
```

## ⚠️ Critical Patterns (MUST FOLLOW)

### Pattern 1: Always Check `isLoading` Before Syncing to Dexie

**❌ WRONG** - Clears cache on page reload:

```typescript
useEffect(() => {
  if (electricResult.data !== undefined) {
    syncElectricToDexie(electricResult.data); // Runs when data === []!
  }
}, [electricResult.data]);
```

**✅ CORRECT** - Preserves cache:

```typescript
useEffect(() => {
  if (!electricResult.isLoading && electricResult.data !== undefined) {
    syncElectricToDexie(electricResult.data);
  }
}, [electricResult.isLoading, electricResult.data]);
```

**Why**: Electric transitions through `undefined` → `[]` → `[...data]`. Syncing at `[]` stage **wipes your cache**!

**CRITICAL**: This check must be in **TWO places**:

1. **Sync useEffect** - When syncing Electric data to Dexie
2. **Cleanup useEffect** - When removing confirmed local changes

```typescript
// Sync
useEffect(() => {
  if (!electricResult.isLoading && electricResult.data !== undefined) {
    syncElectricToDexie(electricResult.data);
  }
}, [electricResult.isLoading, electricResult.data]);

// Cleanup (ALSO needs isLoading check!)
useEffect(() => {
  if (!electricResult.isLoading && electricResult.data) {
    cleanup(electricResult.data).then(() => refetch());
  }
}, [electricResult.isLoading, electricResult.data]);
```

---

### Pattern 2: Collect ALL Updates Per ID

**❌ WRONG** - Only first update applies:

```typescript
for (const change of local) {
  if (change._op === "update") {
    const synced = syncedMap.get(change.id);
    if (synced) {
      result.push({ ...synced, ...change.data });
    }
    // Second update to same ID? Ignored!
  }
}
```

**✅ CORRECT** - Apply all updates sequentially:

```typescript
// Phase 1: Collect by type
const pendingInserts = new Map<string, any>();
const pendingUpdates = new Map<string, any[]>(); // Array per ID!
const pendingDeletes = new Set<string>();

for (const change of local) {
  if (change._op === "insert") {
    pendingInserts.set(change.id, change);
  } else if (change._op === "update") {
    if (!pendingUpdates.has(change.id)) {
      pendingUpdates.set(change.id, []);
    }
    pendingUpdates.get(change.id)!.push(change); // Collect all
  } else if (change._op === "delete") {
    pendingDeletes.add(change.id);
  }
}

// Phase 2: Process pending inserts (may have updates)
for (const [id, insert] of pendingInserts) {
  if (pendingDeletes.has(id)) continue;

  let merged = insert.data;
  const updates = pendingUpdates.get(id);
  if (updates) {
    for (const update of updates) {
      merged = { ...merged, ...update.data }; // Apply sequentially
    }
  }
  result.push(merged);
}

// Phase 3: Process synced items with updates
for (const [id, updates] of pendingUpdates) {
  if (processedIds.has(id)) continue;
  const synced = syncedMap.get(id);
  if (synced) {
    let merged = synced;
    for (const update of updates) {
      merged = { ...merged, ...update.data };
    }
    result.push(merged);
  }
}
```

**Why**: User creates item, updates title, updates color - all before Electric syncs. Must apply ALL updates, not just first!

---

### Pattern 3: Query Invalidation Must Match Key Prefix

**❌ WRONG** - Query never refetches:

```typescript
// Mutation
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["items"] });
};

// Query (doesn't match!)
useQuery({
  queryKey: ["items", "merged", "filtered", id],
  // ...
});
```

**✅ CORRECT** - Consistent prefixes:

```typescript
// Mutation
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["items", "merged"] }); // Matches prefix
};

// Query
useQuery({
  queryKey: ["items", "merged", "filtered", id],
  // ...
});
```

**Why**: React Query matches by prefix. `["items"]` doesn't match `["items", "merged", ...]`.

---

### Pattern 4: Schema Transforms Must Preserve Distinct Fields

When Postgres schema differs from client schema, **map each field explicitly**:

**❌ WRONG** - Loses field distinction:

```typescript
// Client → Postgres
if (metadata.notes || metadata.title) {
  result.content = metadata.notes || metadata.title; // Title overwrites notes!
}

// Postgres → Client
if (content) {
  clientMetadata.notes = content; // Title becomes notes!
}
```

**✅ CORRECT** - Separate mappings:

```typescript
// Client → Postgres
if (metadata.notes) {
  result.content = metadata.notes; // Notes → TEXT column
}
if (metadata.title) {
  result.metadata = { ...result.metadata, title: metadata.title }; // Title → JSONB
}

// Postgres → Client
if (content) {
  clientMetadata.notes = content; // TEXT column → notes
}
if (metadata?.title) {
  clientMetadata.title = metadata.title; // JSONB → title
}
```

**Update in 3 places**:

1. `apps/web/app/api/writes/batch/route.ts` - Client → Postgres transform
2. `packages/data/src/electric.ts` - Postgres → Client transform (Electric sync)
3. `packages/data/src/repos/*.merged.ts` - `ensureClientSchema()` helper

---

## 🔧 Implementation Checklist

### 1. Database Schema (Dexie)

```typescript
// db.ts - Add local table
annotations_local: "id, _op, _status, _timestamp, data";
```

### 2. Local Repository (`annotations.local.ts`)

```typescript
export async function createAnnotationLocal(input: CreateAnnotationInput) {
  const annotation = { ...input, createdAt: Date.now(), updatedAt: Date.now() };

  // Write to local table (instant UI)
  await db.annotations_local.add({
    id: annotation.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: annotation,
  });

  // Enqueue for background sync
  await buffer.enqueue({
    table: "annotations",
    op: "insert",
    payload: annotation,
  });

  return annotation;
}
```

### 3. Merge Repository (`annotations.merged.ts`)

```typescript
export async function getMergedPDFAnnotations(sha256: string) {
  try {
    const synced = await db.annotations
      .where("sha256")
      .equals(sha256)
      .toArray();
    const local = await db.annotations_local.toArray();
    const merged = await mergeAnnotations(synced, local);
    return merged.filter((a) => a.sha256 === sha256);
  } catch (error) {
    console.error("[getMergedPDFAnnotations] Error:", error);
    return []; // Always return array, never undefined
  }
}
```

### 4. React Hook (`useAnnotations.ts`)

```typescript
export function usePDFAnnotations(sha256: string) {
  const electricResult = annotationsElectric.usePDFAnnotations(sha256);

  // CRITICAL: Check isLoading before syncing
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data !== undefined) {
      syncElectricToDexie(electricResult.data).catch(console.error);
    }
  }, [electricResult.isLoading, electricResult.data]);

  // Query merged data
  const mergedQuery = useQuery({
    queryKey: ["annotations", "merged", "pdf", sha256],
    queryFn: () => annotationsMerged.getMergedPDFAnnotations(sha256),
    staleTime: 0, // Always check for local changes
    placeholderData: [], // Prevent loading flicker on navigation
  });

  // Cleanup after sync
  // CRITICAL: Check isLoading to avoid cleanup on initial undefined state
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data) {
      annotationsCleanup
        .cleanupSyncedAnnotations(electricResult.data)
        .then(() => mergedQuery.refetch());
    }
  }, [electricResult.isLoading, electricResult.data]);

  return {
    ...mergedQuery,
    isLoading: mergedQuery.isLoading, // Only merged query (not Electric!)
    isSyncing: electricResult.isLoading,
  };
}
```

### 5. Mutation Hook

```typescript
export function useUpdateAnnotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateAnnotationInput) => {
      await annotationsLocal.updateAnnotationLocal(input);
      return input;
    },
    onSuccess: () => {
      // Invalidate with correct prefix
      queryClient.invalidateQueries({ queryKey: ["annotations", "merged"] });
    },
  });
}
```

---

## 🐛 Common Bugs & Fixes

### Bug: Empty Data After Page Reload

**Symptom**: Data appears after 1-2 seconds  
**Cause**: Missing `!electricResult.isLoading` check  
**Fix**: Add check in ALL entity hooks

### Bug: Only First Update Applies

**Symptom**: Create annotation, update title, update color - color ignored  
**Cause**: Merge logic doesn't collect multiple updates  
**Fix**: Use `Map<string, any[]>` to collect all updates per ID

### Bug: UI Doesn't Update After Mutation

**Symptom**: Query invalidation called but UI stale  
**Cause**: Query key mismatch  
**Fix**: Ensure consistent `["entity", "merged"]` prefix

### Bug: Fields Disappear After Sync

**Symptom**: Title becomes notes, or vice versa  
**Cause**: Schema transform using wrong columns  
**Fix**: Map each field to correct Postgres column type

### Bug: "Query data cannot be undefined" Error

**Symptom**: React Query crashes on deletion  
**Cause**: Merge function returns `undefined` on error  
**Fix**: Wrap in try-catch, always return array/value

### Bug: Data Still Shows After Database Wipe

**Symptom**: After clearing database, files/items still appear until page refresh  
**Cause**: React Query cache not properly invalidated, or wrong order of operations  
**Fix**: Clear in correct order:

1. Clear Dexie FIRST (all synced + local tables)
2. Clear React Query cache (`queryClient.clear()`)
3. Force refetch all merged queries (`refetchQueries`)
4. Clear Postgres in background

**Example (Database Clear):**

```typescript
// 1. Clear Dexie first (parallel for speed)
await db.transaction("rw", [...allTables], async () => {
  await Promise.all([
    db.works.clear(),
    db.assets.clear(),
    // ... all synced tables
    db.works_local.clear(),
    db.assets_local.clear(),
    // ... all local tables
  ]);
});

// 2. Clear React Query cache
queryClient.clear();

// 3. Force refetch to show empty state
await Promise.all([
  queryClient.refetchQueries({ queryKey: ["assets", "merged"] }),
  queryClient.refetchQueries({ queryKey: ["works", "merged"] }),
  // ... all entity merged queries
]);

// 4. Clear Postgres (background confirmation)
await fetch("/api/admin/database", { method: "DELETE" });
```

### Bug: Loading Spinner on Navigation Between Pages

**Symptom**: When navigating between pages, hooks show loading state briefly even though data should be cached  
**Cause**: Using `initialData: []` with `staleTime: 0` causes React Query to:

- Start with initial data (no loading)
- Immediately mark as stale
- Refetch and show `isLoading: true`

**Fix**: Use `placeholderData` instead of `initialData`:

```typescript
// ❌ WRONG - causes loading flicker
const mergedQuery = useQuery({
  queryKey: ["assets", "merged"],
  queryFn: () => assetsMerged.getAllMergedAssets(),
  staleTime: 0,
  initialData: [], // Shows as "fresh" then refetches
});

// ✅ CORRECT - no loading flicker
const mergedQuery = useQuery({
  queryKey: ["assets", "merged"],
  queryFn: () => assetsMerged.getAllMergedAssets(),
  staleTime: 0,
  placeholderData: [], // Shows while loading, doesn't count as "fresh"
});
```

**Why**: `placeholderData` is shown while loading but doesn't prevent the initial fetch. `initialData` is treated as real data and triggers staleness checks.

---

## 📊 Data Flow Diagram

```
┌─────────────┐
│ User Action │
└──────┬──────┘
       │
       ▼
┌──────────────────┐      ┌─────────────────┐
│ Local Repository │─────▶│ WriteBuffer     │
│ (*.local.ts)     │      │ (enqueue)       │
└────────┬─────────┘      └────────┬────────┘
         │                         │
         │ Write to                │ Background
         │ Dexie                   │ Flush
         ▼                         ▼
┌──────────────────┐      ┌─────────────────┐
│ annotations_     │      │ POST /api/      │
│   local          │      │   writes/batch  │
└────────┬─────────┘      └────────┬────────┘
         │                         │
         │                         ▼
         │                ┌─────────────────┐
         │                │ Postgres INSERT │
         │                └────────┬────────┘
         │                         │
         │                         ▼
         │                ┌─────────────────┐
         │                │ Electric Sync   │
         │                └────────┬────────┘
         │                         │
         │                         ▼
         │                ┌─────────────────┐
         │                │ useShape()      │
         │                │ (React state)   │
         │                └────────┬────────┘
         │                         │
         │                         ▼
         │                ┌─────────────────┐
         │                │ syncElectric    │
         │                │   ToDexie()     │
         │                └────────┬────────┘
         │                         │
         │                         ▼
         │                ┌─────────────────┐
         └───────────────▶│ annotations     │
                          │ (synced)        │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │ Merge Layer     │
                          │ (*.merged.ts)   │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │ React Query     │
                          │ (UI sees merged)│
                          └─────────────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │ Cleanup Layer   │
                          │ (remove local)  │
                          └─────────────────┘
```

---

## ✅ Verification Checklist

After implementing optimistic updates:

- [ ] Create item → appears instantly
- [ ] Update item → changes instantly
- [ ] Delete item → disappears instantly
- [ ] Create + rapid updates (title, color, etc.) → all apply
- [ ] Page refresh → data persists (doesn't disappear)
- [ ] Navigate between pages → no loading spinner (cached data shows)
- [ ] Check DevTools → WriteBuffer flushes in background
- [ ] Check Postgres logs → INSERT/UPDATE appears within 2s
- [ ] Wait 1 min → local changes cleaned up
- [ ] Network disconnect → changes queue locally
- [ ] Network reconnect → changes sync automatically
- [ ] Clear database → UI shows empty state immediately (no refresh needed)

---

## 🔗 Related Files

- `OPTIMISTIC_UPDATES_MIGRATION.md` - Full migration checklist with all entities
- `packages/data/src/writeBuffer.ts` - Background sync implementation
- `apps/web/app/api/writes/batch/route.ts` - Server-side write handler
- `packages/data/src/electric.ts` - Electric SQL integration
