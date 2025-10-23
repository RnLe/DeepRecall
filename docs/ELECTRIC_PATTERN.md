# Electric + WriteBuffer Pattern - Implementation Guide

## Overview

We've successfully converted the Works entity to use the **Electric + WriteBuffer** pattern. This is the first step in migrating DeepRecall from a pure Dexie (IndexedDB) approach to a **local-first sync architecture** that works across Web, Desktop, and Mobile.

---

## Architecture

### The Complete Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      React Components                       │
│            (apps/web, apps/desktop, apps/mobile)            │
└───────────────────────┬──────────────┬──────────────────────┘
                        │              │
                 ┌──────▼──────┐  ┌────▼─────┐
                 │  useWorks() │  │ Create/  │
                 │  (Electric) │  │ Update   │
                 └──────┬──────┘  └────┬─────┘
                        │              │
                        │              │
┌───────────────────────▼──────────────▼──────────────────────┐
│              packages/data/repos/works.electric.ts          │
│  ┌─────────────────────┐        ┌────────────────────────┐  │
│  │   READ PATH         │        │   WRITE PATH           │  │
│  │   useShape()        │        │   writeBuffer.enqueue()│  │
│  └──────────┬──────────┘        └──────────┬─────────────┘  │
└─────────────┼─────────────────────────────┼────────────────┘
              │                              │
   ┌──────────▼────────────┐      ┌──────────▼────────────┐
   │  Electric ShapeStream │      │  Write Buffer (Dexie) │
   │  (WebSocket to        │      │  DeepRecallWriteBuffer│
   │   ElectricSQL)        │      │  - Queue pending      │
   └──────────┬────────────┘      │  - Retry on failure   │
              │                   └──────────┬─────────────┘
              │                              │
              │                   ┌──────────▼────────────┐
              │                   │   FlushWorker         │
              │                   │   - Batches changes   │
              │                   │   - Exponential back  │
              │                   └──────────┬─────────────┘
              │                              │
              │                              │ POST
              │                              │ /api/writes/batch
              │                              │
        ┌─────▼──────────────────────────────▼─────────┐
        │          PostgreSQL Database                 │
        │  - Authoritative data source                 │
        │  - Logical replication enabled               │
        └─────┬──────────────────────────────┬─────────┘
              │                              │
              │                              │
              └──────────┬───────────────────┘
                         │
                ┌────────▼─────────┐
                │ Electric Service │
                │ - Broadcasts      │
                │   changes         │
                └───────────────────┘
                         │
                         └──────> Back to all connected clients
```

---

## Key Components

### 1. **works.electric.ts** (New Repository)

**Location:** `packages/data/src/repos/works.electric.ts`

**Read Operations (Hooks):**

- `useWorks()` - Subscribe to all works
- `useWork(id)` - Subscribe to a single work
- `useWorksByType(type)` - Subscribe to works filtered by type
- `useFavoriteWorks()` - Subscribe to favorited works

These hooks use `useShape<Work>()` under the hood, which creates a **live subscription** to Electric. Data updates automatically when Postgres changes.

**Write Operations (Functions):**

- `createWork(data)` - Create new work (optimistic)
- `updateWork(id, updates)` - Update work (optimistic)
- `deleteWork(id)` - Delete work (optimistic)
- `toggleWorkFavorite(work)` - Toggle favorite status
- `createWorkWithAsset(params)` - Create work with linked asset in batch

These functions immediately **enqueue** changes to the write buffer and return. The UI can show changes optimistically while sync happens in background.

---

### 2. **Electric Client** (`electric.ts`)

**Setup:**

```typescript
import { initElectric } from "@deeprecall/data";

// Call once at app startup
initElectric({
  url: "http://localhost:5133", // Electric service URL
  token: "optional-auth-token",
});
```

**useShape Hook:**

```typescript
export function useShape<T>(spec: ShapeSpec<T>): ShapeResult<T> {
  // Returns: { data, isLoading, error, syncStatus }
}
```

**Shape Spec:**

```typescript
interface ShapeSpec<T> {
  table: string; // Postgres table name
  where?: string; // SQL WHERE clause
  columns?: string[]; // Columns to select (default: all)
  parser?: Record<string, (value: string) => unknown>; // Type parsers
}
```

---

### 3. **Write Buffer** (`writeBuffer.ts`)

**Architecture:**

- Separate Dexie database: `DeepRecallWriteBuffer`
- Stores pending changes until synced
- Retry logic with exponential backoff
- Idempotent operations (can replay safely)

**Interface:**

```typescript
interface WriteBuffer {
  enqueue(change: WriteChange): Promise<WriteChange>;
  peek(limit: number): Promise<WriteChange[]>;
  markApplied(ids: string[], responses?: any[]): Promise<void>;
  markFailed(ids: string[], errors: string[]): Promise<void>;
  size(): Promise<number>;
  clear(): Promise<void>;
}
```

**Change Record:**

```typescript
interface WriteChange {
  id: string; // UUID
  table: WriteTable; // Target table
  op: WriteOperation; // "insert" | "update" | "delete"
  payload: any; // Validated data
  created_at: number; // Client timestamp
  status: WriteStatus; // "pending" | "syncing" | "applied" | "error"
  applied_at?: number; // Server confirmation timestamp
  error?: string; // Error message if failed
  retry_count: number; // How many times retried
}
```

---

### 4. **Flush Worker** (`writeBuffer.ts`)

**Purpose:** Background worker that drains the write buffer to the server.

**Setup:**

```typescript
import { initFlushWorker } from "@deeprecall/data";

const worker = initFlushWorker({
  apiBase: "http://localhost:3000",
  batchSize: 10, // Max changes per batch
  retryDelay: 1000, // Initial retry delay (ms)
  maxRetryDelay: 30000, // Max retry delay (ms)
  maxRetries: 5, // Give up after N retries
  token: "auth-token", // Optional
});

worker.start(5000); // Check every 5 seconds
```

**Features:**

- Automatic batching (up to `batchSize` changes)
- Exponential backoff on failures
- Stops retrying after `maxRetries` attempts
- Logs all sync activity for debugging

---

### 5. **Write API** (`/api/writes/batch`)

**Location:** `apps/web/app/api/writes/batch/route.ts`

**Endpoint:** `POST /api/writes/batch`

**Request Body:**

```typescript
{
  changes: WriteChange[]
}
```

**Response:**

```typescript
{
  applied: string[],      // IDs of successfully applied changes
  responses: any[],       // Server responses (for debugging)
  errors?: any[]          // Errors if any
}
```

**Conflict Resolution:**

- **Last-Write-Wins (LWW)** by `updated_at` timestamp
- Server timestamp is authoritative
- Client changes with older timestamps are rejected
- Use Postgres `ON CONFLICT` for idempotency

---

## Usage Examples

### Reading Works

```typescript
import { useWorks } from "@deeprecall/data/repos/worksElectric";

function WorksList() {
  const { data, isLoading, syncStatus } = useWorks();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <div>Sync: {syncStatus}</div>
      {data?.map((work) => (
        <div key={work.id}>{work.title}</div>
      ))}
    </div>
  );
}
```

### Creating a Work

```typescript
import { createWork } from "@deeprecall/data/repos/worksElectric";

async function handleCreateWork() {
  const work = await createWork({
    kind: "work",
    title: "New Paper",
    workType: "paper",
    topics: ["AI", "ML"],
  });

  console.log("Work created (pending sync):", work.id);
  // Work is queued in write buffer
  // FlushWorker will sync to server
  // Electric will broadcast back to all clients
}
```

### Updating a Work

```typescript
import { updateWork } from "@deeprecall/data/repos/worksElectric";

async function handleToggleFavorite(workId: string) {
  await updateWork(workId, {
    favorite: true,
  });
  // Change queued, will sync in background
}
```

---

## Differences from Pure Dexie

### Old Pattern (Dexie Only)

```typescript
// Direct Dexie access
import { db } from "@deeprecall/data/db";

const works = await db.works.toArray();
await db.works.add(newWork);
```

**Limitations:**

- ❌ No sync between devices
- ❌ Data only in browser (lost on clear cache)
- ❌ No multi-user support
- ❌ Hard to share data with desktop/mobile

### New Pattern (Electric + WriteBuffer)

```typescript
// Electric for reads, WriteBuffer for writes
import { useWorks, createWork } from "@deeprecall/data/repos/worksElectric";

const { data } = useWorks(); // Live-synced from Postgres
await createWork({ ... });   // Queued, synced in background
```

**Benefits:**

- ✅ **Sync everywhere** (web, desktop, mobile)
- ✅ **Offline-first** (queue writes, sync when online)
- ✅ **Authoritative server** (Postgres as source of truth)
- ✅ **Real-time updates** (Electric broadcasts changes)
- ✅ **Conflict resolution** (Last-Write-Wins built-in)
- ✅ **Platform-agnostic** (same code on all platforms)

---

## Next Steps

### 1. **Initialize in App** ✅ (To Do Next)

Add to `apps/web/app/providers.tsx`:

```typescript
"use client";
import { initElectric, initFlushWorker } from "@deeprecall/data";
import { useEffect } from "react";

export function DataProviders({ children }) {
  useEffect(() => {
    // Initialize Electric
    initElectric({
      url: process.env.NEXT_PUBLIC_ELECTRIC_URL || "http://localhost:5133",
    });

    // Start flush worker
    const worker = initFlushWorker({
      apiBase: process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000",
      batchSize: 10,
      retryDelay: 1000,
      maxRetries: 5,
    });
    worker.start(5000);

    return () => {
      worker.stop();
    };
  }, []);

  return <>{children}</>;
}
```

### 2. **Update Library UI**

Replace Dexie calls with Electric hooks:

```diff
- import { db } from "@deeprecall/data/db";
+ import { useWorks, createWork } from "@deeprecall/data/repos/worksElectric";

function Library() {
-  const [works, setWorks] = useState([]);
-  useEffect(() => {
-    db.works.toArray().then(setWorks);
-  }, []);

+  const { data: works, isLoading } = useWorks();
}
```

### 3. **Test End-to-End**

1. Create a work in UI
2. Check write buffer: `await getFlushWorker()?.getBuffer().getAll()`
3. Watch FlushWorker logs in console
4. Check Postgres: `SELECT * FROM works;`
5. Verify work appears in UI via Electric sync

### 4. **Build Optimistic Layer** (Advanced)

For instant UI feedback, overlay local pending writes:

```typescript
function useWorksOptimistic() {
  const { data: synced } = useWorks(); // From Electric
  const pending = usePendingWrites("works"); // From write buffer

  // Merge: pending overrides synced
  return useMemo(() => {
    const map = new Map(synced?.map((w) => [w.id, w]));
    pending.forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [synced, pending]);
}
```

---

## Migration Strategy

### Phase 1: Works (✅ Complete)

- ✅ Created `works.electric.ts`
- ✅ Exported from `@deeprecall/data`
- ✅ Write API ready
- ⏳ Initialize in app
- ⏳ Update library UI

### Phase 2: Assets

- Convert `assets.ts` to `assets.electric.ts`
- Update asset upload/link flows
- Test with Works relationship

### Phase 3: Activities, Collections, Edges

- Convert remaining library entities
- Maintain backward compatibility

### Phase 4: Annotations, Cards

- Convert annotation system
- Integrate with SRS

### Phase 5: Cleanup

- Remove old Dexie repos
- Update all UI components
- Document patterns

---

## Troubleshooting

### Electric Not Connecting

```bash
# Check Electric service
docker-compose ps electric

# Check logs
docker-compose logs -f electric

# Verify endpoint
curl http://localhost:5133/v1/shape?table=works
```

### Write Buffer Not Flushing

```typescript
// Check pending changes
const buffer = getFlushWorker()?.getBuffer();
const pending = await buffer?.getAll();
console.log("Pending writes:", pending);

// Manual flush
await getFlushWorker()?.flush();
```

### Conflicts/Duplicate Data

- Check `updated_at` timestamps
- Verify server conflict resolution
- Clear write buffer if needed: `await buffer.clear()`

---

## Files Modified/Created

✅ **Created:**

- `/packages/data/src/repos/works.electric.ts` - New Electric-based repo

✅ **Updated:**

- `/packages/data/src/repos/index.ts` - Export `worksElectric`
- `/packages/data/src/index.ts` - Export `electric` and `writeBuffer`
- `/REFACTOR_CHECKLIST.md` - Document progress

✅ **Already Existing:**

- `/packages/data/src/electric.ts` - Electric client
- `/packages/data/src/writeBuffer.ts` - Write buffer & flush worker
- `/apps/web/app/api/writes/batch/route.ts` - Write API
- `/migrations/001_initial_schema.sql` - Postgres schema

---

## Key Takeaways

1. **Repos are the abstraction layer** - Convert repos, not UI components
2. **Read = Electric, Write = Buffer** - Clear separation of concerns
3. **Optimistic by default** - Writes return immediately, sync in background
4. **Platform-agnostic** - Same code works on web, desktop, mobile
5. **Postgres is truth** - Server is authoritative, clients are caches
6. **Offline-first** - Queue writes, sync when online

This pattern is the foundation for multi-platform DeepRecall! 🚀
