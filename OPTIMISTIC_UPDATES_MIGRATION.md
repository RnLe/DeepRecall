# Optimistic Updates Migration - Progress Tracker

## ⚠️ CRITICAL PATTERNS - READ FIRST

### Pattern 1: Electric → Dexie Sync Must Check isLoading

**WRONG** ❌ - Clears cache on page reload:

```typescript
useEffect(() => {
  if (electricResult.data !== undefined) {
    syncElectricToDexie(electricResult.data); // Runs when data === []!
  }
}, [electricResult.data]);
```

**CORRECT** ✅ - Preserves cache until real data arrives:

```typescript
useEffect(() => {
  if (!electricResult.isLoading && electricResult.data !== undefined) {
    syncElectricToDexie(electricResult.data); // Only runs after initial load
  }
}, [electricResult.isLoading, electricResult.data]);
```

**Why**: Electric data transitions through: `undefined` → `[]` → `[...data]`

- Syncing at `[]` stage clears Dexie cache
- Checking `isLoading` ensures we only sync after real data arrives
- Result: Data persists across page reloads

### Pattern 2: Merge Must Handle Updates to Pending Inserts

**WRONG** ❌ - Updates to new items disappear:

```typescript
for (const localChange of local) {
  if (localChange._op === "update") {
    const synced = syncedMap.get(localChange.id);
    if (synced) {
      result.push({ ...synced, ...localChange.data }); // Only merges with synced!
    }
    // If not synced yet, update is silently ignored!
  }
}
```

**CORRECT** ✅ - Collect all updates and merge them sequentially:

```typescript
// Collect all local changes by type
const pendingInserts = new Map<string, any>();
const pendingUpdates = new Map<string, any[]>(); // Array of updates per ID!
const pendingDeletes = new Set<string>();

for (const change of local) {
  if (change._op === "insert") {
    pendingInserts.set(change.id, change);
  } else if (change._op === "update") {
    if (!pendingUpdates.has(change.id)) {
      pendingUpdates.set(change.id, []);
    }
    pendingUpdates.get(change.id)!.push(change); // Collect ALL updates
  } else if (change._op === "delete") {
    pendingDeletes.add(change.id);
  }
}

// Process: annotations with pending inserts
for (const [id, insertChange] of pendingInserts) {
  if (pendingDeletes.has(id)) continue;

  let merged = insertChange.data;
  const updates = pendingUpdates.get(id);
  if (updates) {
    // Apply ALL updates sequentially
    for (const update of updates) {
      merged = { ...merged, ...update.data };
    }
  }
  result.push(merged);
}

// Process: synced annotations with updates
for (const [id, updates] of pendingUpdates) {
  const synced = syncedMap.get(id);
  if (synced && !processedIds.has(id)) {
    let merged = synced;
    // Apply ALL updates sequentially
    for (const update of updates) {
      merged = { ...merged, ...update.data };
    }
    result.push(merged);
  }
}
```

**Why**: User creates item, then makes multiple rapid updates before Electric syncs

- CREATE writes to `_local` with `_op: "insert"`
- UPDATE #1 writes to `_local` with `_op: "update"` (e.g., title)
- UPDATE #2 writes to `_local` with `_op: "update"` (e.g., color)
- Merge must combine ALL of them before sync completes
- **Critical**: Must handle MULTIPLE updates to same annotation, not just one!
- Result: All updates show instantly, in correct order

### Pattern 3: Schema Transforms Must Preserve Field Distinctions

**WRONG** ❌ - Losing distinction between title and notes:

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

**CORRECT** ✅ - Use separate fields for separate concerns:

```typescript
// Client → Postgres: Store in different Postgres fields
if (metadata.notes) {
  result.content = metadata.notes; // Notes in TEXT column
}
if (metadata.title) {
  result.metadata = { ...result.metadata, title: metadata.title }; // Title in JSONB
}

// Postgres → Client: Extract from correct locations
if (content) {
  clientMetadata.notes = content; // Notes from TEXT column
}
if (metadata?.title) {
  clientMetadata.title = metadata.title; // Title from JSONB
}
```

**Why**: Postgres has different column types

- `content` is TEXT (for large notes)
- `metadata` is JSONB (for structured data like title)
- Can't store both title and notes in single TEXT field without losing one
- Must use JSONB metadata for title to preserve both fields
- **Update transforms in 3 places**: `route.ts`, `electric.ts`, `annotations.merged.ts`

---

## Architecture Overview

**Problem**: 2-3s delay (WriteBuffer → Postgres → Electric → UI)

**Solution**: Two-layer state management

```
User Action → [INSTANT] Local Dexie → [INSTANT] UI Update
            ↓
            [BACKGROUND] WriteBuffer → Postgres → Electric → Cleanup
```

## File Structure Convention

For each entity (e.g., `presets`):

- `repos/presets.local.ts` - Optimistic writes to Dexie (instant)
- `repos/presets.electric.ts` - Electric sync layer (background)
- `repos/presets.merged.ts` - Merge logic (local + synced)
- `hooks/usePresets.ts` - React hooks (returns merged data)

## Phase 1: Presets Entity

### ✅ Database Schema

- [x] Add `presets_local` table to Dexie (v8 migration)
- [x] Define LocalPresetChange interface with `_op`, `_status`, `_timestamp`

### ✅ Repository Layer

- [x] Create `repos/presets.local.ts`
  - [x] `createPresetLocal()` - Write to Dexie + enqueue
  - [x] `updatePresetLocal()` - Write to Dexie + enqueue
  - [x] `deletePresetLocal()` - Mark deleted + enqueue
  - [x] Helper functions for sync status tracking

### ✅ Merge Layer

- [x] Create `repos/presets.merged.ts`
  - [x] `mergePresets()` - Combine synced + local with conflict rules
  - [x] `getMergedPreset()` - Single preset by ID
  - [x] `getAllMergedPresets()` - All merged presets
  - [x] `getMergedPresetsForTarget()` - Filtered by target entity
  - [x] `getMergedSystemPresets()` - System presets only

### ✅ Hook Layer

- [x] Update `hooks/usePresets.ts`
  - [x] `usePresets()` - Return merged data with auto-refresh
  - [x] `usePreset(id)` - Single merged preset
  - [x] `usePresetsForTarget()` - Filtered merged data
  - [x] `useSystemPresets()` - System presets merged
  - [x] `useCreatePreset()` - Use local layer (instant)
  - [x] `useUpdatePreset()` - Use local layer (instant)
  - [x] `useDeletePreset()` - Use local layer (instant)

### ✅ Testing & Cleanup

- [x] Test create preset → instant UI → background sync
- [x] Test update preset → instant UI → merge logic
- [x] Test delete preset → instant filter → cleanup
- [x] Add cleanup logic when Electric confirms sync
- [ ] Handle error states (\_status: 'error')
- [x] Fix initialization blocking (remove Electric wait)
- [x] Fix initialization counting delete tombstones as existing
- [x] Add debouncing to prevent redundant cleanup runs
- [x] Reduce excessive merge logging
- [x] Sync Electric data to Dexie for merge layer
- [x] **CRITICAL**: Fix WriteBuffer URL trailing slash issue

**Issues Fixed**:

- ✅ Initialization no longer blocks on Electric sync (uses local layer)
- ✅ Initialization ignores delete tombstones (only counts real presets)
- ✅ Cleanup debounced (100ms) to prevent redundant runs from multiple hooks
- ✅ Cleanup skips if data unchanged (hash check)
- ✅ Reduced excessive [Merge] logging (operations now silent)
- ✅ Delete works instantly with proper background sync
- ✅ Electric data now synced to Dexie `presets` table
  - Electric `useShape()` only updates React state, not Dexie
  - Added `db.presets.bulkPut()` to sync Electric → Dexie
  - Merge layer now sees both synced (Electric) + local (optimistic) data
  - Fixes: Custom presets not showing, deleted presets reappearing on refresh
- ✅ **CRITICAL**: Fixed Postgres writes never happening (TWO issues)
  1. **Trailing slash issue**:
     - WriteBuffer POSTed to `/api/writes/batch` (no trailing slash)
     - Next.js route is `/api/writes/batch/` (requires trailing slash)
     - 308 redirect lost POST body → No writes reached Postgres
     - Fixed: Changed URL to `/api/writes/batch/`
  2. **Zod UUID validation too strict**:
     - Zod's `.uuid()` has very strict pattern matching
     - Rejected valid UUIDs from `uuid` library
     - 500 error: "Invalid UUID" on all writes
     - Fixed: Changed to `.string().min(1)` (accept any non-empty ID)
  - **All writes now properly sync to Postgres → Electric → UI**
- ✅ **CRITICAL**: Fixed stale data after batch delete (Electric→Dexie sync bug)
  1. **Root cause**: Electric-to-Dexie sync only ran when `data.length > 0`
     - When all presets deleted, Electric returned 0 rows
     - Condition `if (electricResult.data && electricResult.data.length > 0)` was false
     - `bulkPut()` never called → Dexie `presets` table never cleared
     - Merge layer read stale data from Dexie → UI showed deleted presets
  2. **Solution**: Proper replace strategy in `syncElectricToDexie()`
     - Check `if (electricResult.data !== undefined)` (sync even when empty)
     - Use transaction to atomically: compare IDs → delete stale → bulk put new
     - Logs: `[Electric→Dexie] Deleted N stale preset(s)` / `Synced N preset(s)`
  3. **Blueprint for other entities**:
     - NEVER skip sync when data is empty
     - Always replace entire table (don't just append)
     - Use transactions for atomic clear+put operations
  - **Batch deletes now work correctly; refresh shows accurate state**

**Testing/Debugging**:

- Enable Postgres query logging in `docker-compose.yml`:
  - `log_statement=all` - See every SQL query
  - `synchronous_commit=on` - Force immediate WAL flush
  - Restart: `docker compose restart db`
- Page refresh resets UI because Electric sync takes 1-2s (inherent latency)
- Optimistic updates hide this latency during normal use

## Phase 2: Remaining Entities

**CRITICAL LESSON from Presets**: When syncing Electric → Dexie in hooks:

```typescript
// ❌ WRONG - skips sync when empty, leaves stale data
if (electricResult.data && electricResult.data.length > 0) {
  db.table.bulkPut(electricResult.data);
}

// ✅ CORRECT - always sync, replace entire table
if (electricResult.data !== undefined) {
  await syncElectricToDexie(electricResult.data);
}

// syncElectricToDexie implementation:
async function syncElectricToDexie(electricData: Entity[]): Promise<void> {
  await db.transaction("rw", db.table, async () => {
    const currentIds = new Set(await db.table.toCollection().primaryKeys());
    const electricIds = new Set(electricData.map((e) => e.id));
    const idsToDelete = Array.from(currentIds).filter(
      (id) => !electricIds.has(id)
    );

    if (idsToDelete.length > 0) {
      await db.table.bulkDelete(idsToDelete);
    }
    if (electricData.length > 0) {
      await db.table.bulkPut(electricData);
    }
  });
}
```

### Works

- [x] Add `works_local` table to Dexie (v9 migration)
- [x] Create `repos/works.local.ts`
- [x] Create `repos/works.merged.ts`
- [x] Create `repos/works.cleanup.ts`
- [x] Update `hooks/useWorks.ts` (uses syncElectricToDexie pattern!)
- [x] CRUD operations migrated:
  - [x] `useCreateWork()` - instant local write
  - [x] `useUpdateWork()` - instant local write
  - [x] `useDeleteWork()` - instant local write
  - [x] `useToggleWorkFavorite()` - instant local write
  - [x] `useCreateWorkWithAsset()` - temporary bridge (uses Electric until Assets migrated)
- [x] Query hooks migrated:
  - [x] `useWorks()` - merged data
  - [x] `useWork(id)` - merged single work
  - [x] `useWorksByType()` - merged filtered
  - [x] `useFavoriteWorks()` - merged favorites
  - [x] `useSearchWorks()` - client-side search on merged data
- [x] **Loading optimization**: Only use merged query loading state (not Electric)
  - `initialData: []` prevents loading spinner on navigation
  - `isLoading: mergedQuery.isLoading` returns cached data instantly
  - Electric syncs in background without blocking UI
- [x] **UI integration**: Library page query invalidation after work creation
  - `queryClient.invalidateQueries({ queryKey: ["works", "merged"] })` after LinkBlobDialog success
  - Works appear immediately without page refresh

### Assets

- [x] Add `assets_local` table to Dexie (v10 migration)
- [x] Create `repos/assets.local.ts`
- [x] Create `repos/assets.merged.ts`
- [x] Create `repos/assets.cleanup.ts`
- [x] Update `hooks/useAssets.ts` (uses syncElectricToDexie pattern!)
- [x] CRUD operations migrated:
  - [x] `useCreateAsset()` - instant local write
  - [x] `useUpdateAsset()` - instant local write
  - [x] `useDeleteAsset()` - instant local write
- [x] Query hooks migrated:
  - [x] `useAssets()` - merged data
  - [x] `useAsset(id)` - merged single asset
  - [x] `useAssetsByWork(workId)` - merged filtered by work
  - [x] `useAssetByHash(sha256)` - merged by content hash
- [x] **Loading optimization**: Only use merged query loading state (not Electric)
  - `initialData: []` prevents loading spinner on navigation
  - `isLoading: mergedQuery.isLoading` returns cached data instantly
  - Electric syncs in background without blocking UI

### Activities ✅

- [x] Add `activities_local` table to Dexie (migration v11)
- [x] Create `repos/activities.local.ts`
- [x] Create `repos/activities.merged.ts`
- [x] Create `repos/activities.cleanup.ts`
- [x] Update `hooks/useActivities.ts` (uses syncElectricToDexie pattern!)
- [x] **Loading optimization**: Only use merged query loading state (not Electric)
  - Same pattern as Works/Assets for instant page navigation

### Authors ✅

- [x] Add `authors_local` table to Dexie (migration v12)
- [x] Create `repos/authors.local.ts`
- [x] Create `repos/authors.merged.ts`
- [x] Create `repos/authors.cleanup.ts`
- [x] Update `hooks/useAuthors.ts` (uses syncElectricToDexie pattern!)
- [ ] Test CRUD operations

### Collections ✅

- [x] Add `collections_local` table to Dexie (migration v13)
- [x] Create `repos/collections.local.ts`
- [x] Create `repos/collections.merged.ts`
- [x] Create `repos/collections.cleanup.ts`
- [x] Create `hooks/useCollections.ts` (uses syncElectricToDexie pattern!)
- [ ] Test CRUD operations

### Edges ✅

- [x] Add `edges_local` table to Dexie (migration v14)
- [x] Create `repos/edges.local.ts`
- [x] Create `repos/edges.merged.ts`
- [x] Create `repos/edges.cleanup.ts`
- [x] Update `hooks/useEdges.ts` (uses syncElectricToDexie pattern!)
- [x] **Loading optimization**: Only use merged query loading state (not Electric)
  - Same pattern as Works/Assets/Activities for instant page navigation
  - Critical for `useUnlinkedAssets()` which depends on edges data

### Annotations ✅

- [x] Add `annotations_local` table to Dexie (migration v15)
- [x] Create `repos/annotations.local.ts`
- [x] Create `repos/annotations.merged.ts`
- [x] Create `repos/annotations.cleanup.ts`
- [x] Update `hooks/useAnnotations.ts` (uses syncElectricToDexie pattern!)
- [x] **CRITICAL BUG FIXES** (4 major issues resolved):

#### Fix 1: Data Persistence After Page Reload

- **Problem**: Annotations empty after reload until Electric syncs (~1-2 seconds)
- **Root cause**: `useAnnotations()` hook missing `!electricResult.isLoading` check
- **Symptom**: Electric data transitions `undefined` → `[]` → `[...data]`, syncing at `[]` cleared cache
- **Solution**: Added `!electricResult.isLoading &&` check in `useAnnotations()` hook
- **Result**: Dexie cache preserved on reload, data shows instantly ✅

#### Fix 2: Title/Notes Field Confusion

- **Problem**: After sync, annotation titles moved to `notes` field (disappeared!)
- **Root cause**: Schema transforms incorrectly handling title vs notes:
  - Client→Postgres: `metadata.title` stored in `content` TEXT column (lost distinction)
  - Postgres→Client: `content` read as `notes` (title vanished!)
- **Solution**:
  - Client→Postgres: Store `notes` in `content`, store `title` in `metadata` JSONB
  - Postgres→Client: Read `content` as `notes`, extract `title` from `metadata` JSONB
  - Updated 3 transform functions: `route.ts`, `electric.ts`, `annotations.merged.ts`
- **Result**: Title and notes both persist correctly through sync ✅

#### Fix 3: Multiple Rapid Updates Not Applying

- **Problem**: Create annotation, update title, update color → only title applied, color ignored
- **Root cause**: Merge logic bug with multiple updates to pending inserts:
  1. INSERT added to result array
  2. First UPDATE replaced it via `findIndex`
  3. Second UPDATE couldn't find it (already replaced)
  4. Second UPDATE silently ignored
- **Solution**: Complete rewrite of merge algorithm:
  - Collect ALL changes first (inserts, updates, deletes)
  - Group multiple UPDATEs by annotation ID into arrays
  - Apply all updates sequentially to each annotation
  - Process in 3 phases: pending inserts with updates, synced with updates, then remaining
- **Result**: Multiple rapid updates all apply correctly, in order ✅

#### Fix 4: Deletion Error "Query data cannot be undefined"

- **Problem**: Deleting annotation crashed with React Query error
- **Root cause**: `getMergedAnnotation(id)` could return `undefined` without try-catch
- **Solution**: Wrapped in try-catch to return `undefined` gracefully
- **Result**: Deletion works without crashes ✅

- [x] **Blueprint for other entities**:
  - MUST check `isLoading` before syncing to Dexie (all 10 entities fixed)
  - MUST collect all updates per ID, not just first one
  - MUST preserve field distinctions in schema transforms
  - MUST wrap merge functions in try-catch for graceful errors

### Cards ✅

- [x] Add `cards_local` table to Dexie (migration v16)
- [x] Create `repos/cards.local.ts`
- [x] Create `repos/cards.merged.ts`
- [x] Create `repos/cards.cleanup.ts`
- [x] Create `hooks/useCards.ts` (uses syncElectricToDexie pattern!)
- [ ] Test CRUD operations

### ReviewLogs ✅

- [x] Add `reviewLogs_local` table to Dexie (migration v17)
- [x] Create `repos/reviewLogs.local.ts`
- [x] Create `repos/reviewLogs.merged.ts`
- [x] Create `repos/reviewLogs.cleanup.ts`
- [x] Create `hooks/useReviewLogs.ts` (uses syncElectricToDexie pattern!)
- [ ] Test CRUD operations

## ✅ ALL ENTITIES MIGRATED!

All data entities have been successfully migrated to the two-layer optimistic updates architecture:

- **Library entities**: Presets, Works, Assets, Activities, Authors, Collections, Edges
- **Annotation entities**: Annotations, Cards, ReviewLogs

Each entity now has:

- Local layer (`*_local` table) for instant writes
- Merge layer (`*.merged.ts`) for combining synced + local data
- Cleanup layer (`*.cleanup.ts`) for auto-cleanup after sync
- Hooks (`use*.ts`) with syncElectricToDexie pattern

## Phase 3: Sync Confirmation & Cleanup

- [x] Create sync confirmation handler
  - [x] Listen for Electric shape updates
  - [x] Match synced IDs to local changes
  - [x] Delete confirmed local records
  - [x] Log cleanup actions
  - ✅ Implemented via cleanup repos (debounced 100ms)

- [ ] Add periodic cleanup job
  - [ ] Remove old synced records (>1 hour)
  - [ ] Retry failed syncs with exponential backoff
  - [x] Clear stale errors (>7 days) - implemented in cleanup repos

## Phase 4: Error Handling & UI Feedback

- [ ] Add sync status indicators
  - [ ] Pending icon/badge on items
  - [ ] Error state with retry button
  - [ ] Success confirmation animation

- [ ] Conflict resolution
  - [ ] Detect conflicts (local update vs server update)
  - [ ] Implement LWW (Last Write Wins) by default
  - [ ] Add manual resolution UI for critical conflicts

## Notes

**UI Components**: No changes needed - hooks abstract data source

**Merge Rules**:

1. Local INSERT → Show immediately (pending)
2. Local UPDATE → Override synced data
3. Local DELETE → Filter from results
4. Conflict → Local wins (user's latest intent)
