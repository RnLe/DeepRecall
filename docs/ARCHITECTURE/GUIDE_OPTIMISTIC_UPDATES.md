# Guide: Optimistic Updates with Electric SQL

> **Blueprint for implementing instant UI updates with background sync**
>
> Based on Annotations entity - applies to all entities (Works, Assets, Cards, etc.)
>
> **See also**: `GUIDE_CROSS_DEVICE_REACTIVITY.md` for enabling real-time updates across devices

## 🎯 Core Concept

**Problem**: 2-3 second delay from user action → Postgres → Electric → UI update

**Solution**: Four-layer architecture with guest mode support

```
User Action → [INSTANT] Local Dexie → [INSTANT] UI
            ↓ (background, only if authenticated)
            WriteBuffer → Postgres → Electric → Cleanup
```

**Guest Mode**: When not authenticated, writes stay local-only (no WriteBuffer enqueue).  
**Authenticated Mode**: Full sync pipeline with background WriteBuffer flush to server.

## 📁 File Structure (per entity)

```
packages/data/src/
├── auth.ts                        # Global auth state (guest vs authenticated)
├── repos/
│   ├── annotations.local.ts      # Instant writes to Dexie + WriteBuffer (if auth)
│   ├── annotations.electric.ts   # Electric shapes (background sync)
│   ├── annotations.merged.ts     # Merge synced + local data
│   └── annotations.cleanup.ts    # Remove local after sync confirmation
└── hooks/
    └── useAnnotations.ts          # React hooks returning merged data
```

**Key Addition**: `auth.ts` manages global authentication state, used by all local repos to conditionally enqueue server writes.

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
import { isAuthenticated } from "../auth";

export async function createAnnotationLocal(input: CreateAnnotationInput) {
  const annotation = { ...input, createdAt: Date.now(), updatedAt: Date.now() };

  // Write to local table (instant UI - works for both guest and authenticated)
  await db.annotations_local.add({
    id: annotation.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: annotation,
  });

  // Enqueue for background sync (only if authenticated)
  if (isAuthenticated()) {
    await buffer.enqueue({
      table: "annotations",
      op: "insert",
      payload: annotation,
    });
  }

  logger.info("db.local", "Created annotation (pending sync)", {
    annotationId: annotation.id,
    willSync: isAuthenticated(),
  });

  return annotation;
}
```

**Critical**: Check `isAuthenticated()` before enqueuing to WriteBuffer. Guests get full local functionality without server dependency.

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

**IMPORTANT**: All `use*Sync()` hooks MUST be called exactly once by the centralized `SyncManager` component. Never call sync hooks directly from multiple components - this causes race conditions and duplicate Electric connections.

```typescript
// ============================================================================
// Sync Hooks (Internal - Called by SyncManager ONLY)
// ============================================================================

/**
 * Internal sync hook: Subscribes to Electric and syncs to Dexie
 * CRITICAL: Must only be called ONCE by SyncManager to prevent race conditions
 *
 * DO NOT call this from components! Use usePDFAnnotations() instead.
 * @param userId - Filter annotations by owner_id (multi-tenant isolation)
 */
export function useAnnotationsSync(userId?: string) {
  const electricResult = annotationsElectric.useAnnotations(userId);
  const queryClient = useQueryClient();

  // CRITICAL: Check isLoading before syncing
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data !== undefined) {
      syncElectricToDexie(electricResult.data)
        .then(() => {
          // Invalidate to trigger cross-device updates
          queryClient.invalidateQueries({ queryKey: ["annotations"] });
        })
        .catch(console.error);
    }
  }, [electricResult.isLoading, electricResult.data]);

  // Cleanup after sync
  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data) {
      annotationsCleanup
        .cleanupSyncedAnnotations(electricResult.data)
        .catch(console.error);
    }
  }, [electricResult.isLoading, electricResult.data]);

  return electricResult;
}

// ============================================================================
// Public Hooks (Use these in components)
// ============================================================================

/**
 * Get merged annotations for a PDF (synced + local changes)
 * Sync is handled by useAnnotationsSync() in SyncManager.
 */
export function usePDFAnnotations(sha256: string) {
  const mergedQuery = useQuery({
    queryKey: ["annotations", "merged", "pdf", sha256],
    queryFn: () => annotationsMerged.getMergedPDFAnnotations(sha256),
    staleTime: 0, // Always check for local changes
    placeholderData: [], // Prevent loading flicker on navigation
  });

  return mergedQuery;
}
```

**SyncManager Pattern**: Centralized component that calls all `use*Sync()` hooks exactly once:

```typescript
// apps/web/app/providers.tsx (or mobile/desktop equivalent)
function SyncManager({ userId }: { userId?: string }) {
  // Call ALL sync hooks once - prevents duplicate Electric connections
  useWorksSync(userId);
  useAssetsSync(userId);
  useActivitiesSync(userId);
  useAnnotationsSync(userId);
  useCardsSync(userId);
  // ... all entities

  return null; // No UI, just sync orchestration
}
```

**Why This Matters**:

- ✅ Each entity syncs exactly once
- ✅ No race conditions from multiple Electric connections
- ✅ Clean separation: sync hooks (internal) vs. query hooks (public)
- ✅ Guest mode: `SyncManager` only renders when authenticated

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

### Bug: Continuous Actions (Drawing, Erasing) Feel Laggy

**Symptom**: Interactive tools (brush, eraser) only show results after mouse release, not during gesture  
**Cause**: Only updating database state on action completion; rendering waits for query refetch  
**Fix**: Dual-layer state for continuous actions:

```typescript
// Layer 1: In-memory scene state (instant visual feedback)
const orchestratorRef = useRef<SceneOrchestrator>(new SceneOrchestrator());

// Layer 2: Database state (persistent, synced)
const { data: items } = useMergedItems(id);

// Sync database → scene when data changes
useEffect(() => {
  orchestrator.clear();
  items.forEach((item) => orchestrator.add(item));
  renderScene();
}, [items]);

// CRITICAL: Update scene immediately during gesture
const handlePointerMove = (e) => {
  if (tool === "eraser") {
    const hits = orchestrator.query(pointerPos);
    hits.forEach((item) => {
      orchestrator.remove(item.id); // Instant visual removal
      eraserHitsRef.current.add(item.id); // Track for DB deletion
    });
    renderScene(); // Re-render immediately
  }
};

// Commit to database on gesture end
const handlePointerUp = () => {
  if (eraserHitsRef.current.size > 0) {
    deleteItems.mutate({ ids: Array.from(eraserHitsRef.current) });
    eraserHitsRef.current.clear();
  }
};
```

**Why**: Continuous actions need instant feedback. In-memory updates provide <16ms response; database mutations follow in background. The refetch from merged query will match the scene state (no flicker).

---

## � Guest Mode vs Authenticated Mode

### Guest Mode (Not Authenticated)

```
User Action → Local Dexie (annotations_local) → [INSTANT] UI
                    ↓
              Merge Layer (synced + local)
                    ↓
              React Query → Component

⚠️ WriteBuffer: SKIPPED (no server sync)
⚠️ Electric: No sync (userId = undefined)
✅ Full local functionality preserved
```

### Authenticated Mode (Signed In)

```
User Action → Local Dexie (annotations_local) → [INSTANT] UI
                    ↓                    ↓
              Merge Layer          WriteBuffer (enqueue)
                    ↓                    ↓
              React Query          POST /api/writes/batch
                    ↓                    ↓
              Component            Postgres (LWW)
                                        ↓
                                   Electric Sync
                                        ↓
                                   useShape() (filtered by userId)
                                        ↓
                                   syncElectricToDexie()
                                        ↓
                              annotations (synced) → Cleanup
```

### Auth State Management

**File**: `packages/data/src/auth.ts`

```typescript
// Global auth state (set by app providers)
let _isAuthenticated = false;
let _userId: string | null = null;

export function setAuthState(
  authenticated: boolean,
  userId: string | null,
  deviceId: string | null = null
): void {
  _isAuthenticated = authenticated;
  _userId = userId;
  // Triggers cleanup/scan logic as needed
}

export function isAuthenticated(): boolean {
  return _isAuthenticated;
}

export function getUserId(): string | null {
  return _userId;
}
```

**Usage in App Providers**:

```typescript
// apps/web/app/providers.tsx
function AuthStateManager({ children }) {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && session) {
      setAuthState(true, session.user.id, deviceId);
    } else if (status === "unauthenticated") {
      setAuthState(false, null, deviceId);
    }
  }, [session, status]);

  return <>{children}</>;
}
```

**Guest Upgrade Flow**:

1. Guest creates data locally (Dexie only)
2. User signs in → `setAuthState(true, userId, deviceId)`
3. Local data gets `owner_id` updated to `userId`
4. WriteBuffer starts flushing pending changes
5. Electric syncs with new user filter

## �📊 Data Flow Diagram (Authenticated Mode)

```
┌─────────────┐
│ User Action │
└──────┬──────┘
       │
       ▼
┌──────────────────┐      ┌─────────────────┐
│ Local Repository │─────▶│ isAuthenticated │
│ (*.local.ts)     │      │ check           │
└────────┬─────────┘      └────────┬────────┘
         │                         │ YES
         │ Write to                │
         │ Dexie                   ▼
         │                ┌─────────────────┐
         ▼                │ WriteBuffer     │
┌──────────────────┐      │ (enqueue)       │
│ annotations_     │      └────────┬────────┘
│   local          │               │ Background
└────────┬─────────┘               │ Flush
         │                         ▼
         │                ┌─────────────────┐
         │                │ POST /api/      │
         │                │   writes/batch  │
         │                └────────┬────────┘
         │                         │
         │                         ▼
         │                ┌─────────────────┐
         │                │ Postgres INSERT │
         │                │ (LWW resolution)│
         │                └────────┬────────┘
         │                         │
         │                         ▼
         │                ┌─────────────────┐
         │                │ Electric Sync   │
         │                │ (SSE stream)    │
         │                └────────┬────────┘
         │                         │
         │                         ▼
         │                ┌─────────────────┐
         │                │ useAnnotations  │
         │                │ Sync(userId)    │
         │                │ (SyncManager)   │
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

## 🌐 Production Environment Setup

### Current Deployment Architecture

| Platform    | Environment     | Postgres | Electric             | Deployment   |
| ----------- | --------------- | -------- | -------------------- | ------------ |
| **Web**     | Dev + Prod      | Neon DB  | Electric Cloud (SSE) | Railway      |
| **Mobile**  | Dev + Prod      | Neon DB  | Electric Cloud (SSE) | TestFlight   |
| **Desktop** | Production only | Neon DB  | Electric Cloud (SSE) | Local binary |

**Key Architecture Decisions**:

1. **Shared Neon Database**: All environments (dev + prod) use the same Neon Postgres instance

   - ✅ True multi-device testing in development
   - ✅ No schema drift between dev and prod
   - ✅ RLS (Row-Level Security) provides user isolation
   - ⚠️ Dev writes go to production database (acceptable with proper RLS filtering by `owner_id`)

2. **Electric Cloud**: All apps connect to Electric Cloud service

   - ✅ Managed SSE streaming (no self-hosting needed)
   - ✅ Consistent sync behavior across platforms
   - ✅ Authentication via `sourceId` and `secret`

3. **No Docker in Dev**: Direct connection to production services
   - ✅ Simplified local development setup
   - ✅ Instant sync testing across devices
   - ✅ Realistic network conditions (not localhost)

### Electric Sync Configuration

**File**: `packages/data/src/electric.ts`

```typescript
/**
 * Sync mode configuration
 *
 * IMPORTANT: The SYNC_MODE setting appears to be legacy API.
 * Regardless of the value ("development" or "production"), Electric
 * actually uses SSE (Server-Sent Events) streaming by default.
 *
 * The "development" mode (10s polling) setting does NOT actually poll.
 * It still uses SSE streaming, which is the correct behavior.
 *
 * We keep this setting for potential future API changes, but in practice,
 * Electric Cloud always uses SSE for real-time updates.
 */
const SYNC_MODE: "development" | "production" = "development";
```

**Runtime Configuration** (loaded from server):

```typescript
// Apps fetch Electric config from /api/config at startup
const response = await fetch("/api/config");
const config = await response.json();

initElectric({
  url: config.electricUrl, // Electric Cloud URL
  sourceId: config.electricSourceId, // Electric Cloud source ID
  secret: config.electricSecret, // Electric Cloud source secret
});
```

**Why SSE Matters**:

- ✅ Real-time updates (no polling delay)
- ✅ Efficient (server pushes only when data changes)
- ✅ Battery-friendly (no constant HTTP requests)
- ✅ Works across all platforms (web, mobile, desktop)

**Electric Cloud Authentication**:

- Production: Uses `sourceId` and `secret` from environment variables
- Development: Same credentials (shared database approach)
- Guest Mode: Electric initialized but no shapes synced (`userId = undefined`)

### Multi-Tenant Security (RLS)

All Electric shapes are filtered by `owner_id`:

```typescript
export function useWorks(userId?: string) {
  return useShape<Work>({
    table: "works",
    where: userId ? `owner_id = '${userId}'` : undefined,
  });
}
```

**Security Guarantees**:

- ✅ Guests: No Electric sync (local-only, `userId = undefined`)
- ✅ Authenticated: Only see their own data (`owner_id = userId`)
- ✅ Multi-tenant: Postgres RLS enforced at database level
- ✅ Cross-device: Same user sees same data on all devices

## ✅ Verification Checklist

After implementing optimistic updates:

### Local Functionality

- [ ] Create item → appears instantly
- [ ] Update item → changes instantly
- [ ] Delete item → disappears instantly
- [ ] Create + rapid updates (title, color, etc.) → all apply
- [ ] Page refresh → data persists (doesn't disappear)
- [ ] Navigate between pages → no loading spinner (cached data shows)
- [ ] Clear database → UI shows empty state immediately (no refresh needed)

### Guest Mode

- [ ] Guest: Create/update/delete works locally
- [ ] Guest: No WriteBuffer enqueue (check console logs)
- [ ] Guest: No Electric sync (network tab shows no shape requests)
- [ ] Guest: Data persists across page refreshes (Dexie only)
- [ ] Guest: Sign in → data migrates to user account

### Authenticated Mode

- [ ] Check DevTools → WriteBuffer flushes in background
- [ ] Check Postgres logs → INSERT/UPDATE appears within 2s
- [ ] Wait 1 min → local changes cleaned up
- [ ] Network disconnect → changes queue locally
- [ ] Network reconnect → changes sync automatically

### Multi-Device Sync

- [ ] Edit on device A → appears on device B within 2s
- [ ] Create on mobile → appears on web immediately
- [ ] Delete on desktop → disappears on mobile
- [ ] Concurrent edits → last-write-wins (check timestamps)

---

## 🔗 Related Files

- `OPTIMISTIC_UPDATES_MIGRATION.md` - Full migration checklist with all entities
- `packages/data/src/writeBuffer.ts` - Background sync implementation
- `apps/web/app/api/writes/batch/route.ts` - Server-side write handler
- `packages/data/src/electric.ts` - Electric SQL integration
