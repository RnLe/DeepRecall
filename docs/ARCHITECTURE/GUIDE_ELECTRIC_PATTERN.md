# Electric + WriteBuffer Pattern

> **Quick reference for the Electric sync architecture**
>
> **See also**: [`GUIDE_DATA_ARCHITECTURE.md`](GUIDE_DATA_ARCHITECTURE.md) for complete architecture overview

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      React Components                       │
│            (apps/web, apps/desktop, apps/mobile)            │
└───────────────────────┬──────────────┬──────────────────────┘
                        │              │
                 ┌──────▼──────┐  ┌────▼─────┐
                 │  useWorks() │  │ Create/  │
                 │  (Merged)   │  │ Update   │
                 └──────┬──────┘  └────┬─────┘
                        │              │
┌───────────────────────▼──────────────▼──────────────────────┐
│              4-File Repository Pattern                      │
│  ┌─────────────────────┐        ┌────────────────────────┐  │
│  │   READ PATH         │        │   WRITE PATH           │  │
│  │   works.merged.ts   │        │   works.local.ts       │  │
│  │   (synced + local)  │        │   writeBuffer.enqueue()│  │
│  └──────────┬──────────┘        └──────────┬─────────────┘  │
└─────────────┼─────────────────────────────┼────────────────┘
              │                              │
   ┌──────────▼────────────┐      ┌──────────▼────────────┐
   │  works.electric.ts    │      │  WriteBuffer (Dexie)  │
   │  Electric ShapeStream │      │  DeepRecallWriteBuffer│
   │  (SSE from Electric)  │      │  - Queue pending      │
   └──────────┬────────────┘      │  - Retry on failure   │
              │                   └──────────┬─────────────┘
              │                              │
              │                   ┌──────────▼────────────┐
              │                   │   Background Worker   │
              │                   │   - Batch changes     │
              │                   │   - Exponential retry │
              │                   └──────────┬─────────────┘
              │                              │ POST
              │                              │ /api/writes/batch
        ┌─────▼──────────────────────────────▼─────────┐
        │          PostgreSQL (Neon)                   │
        │  - Source of truth                           │
        │  - RLS owner_id filtering                    │
        └─────┬──────────────────────────────┬─────────┘
              │                              │
              └──────────┬───────────────────┘
                         │
                ┌────────▼─────────┐
                │ Electric Service │
                │ - SSE broadcast  │
                └───────────────────┘
                         │
                         └──────> All connected clients
```

---

## 4-File Repository Pattern

Each entity (works, assets, annotations, etc.) uses **4 repository files**:

### 1. `*.local.ts` - Instant Local Writes

**Purpose**: Write to Dexie `*_local` table + enqueue to WriteBuffer

```typescript
export async function createWork(data: WorkInput) {
  const work = { id: uuid(), ...data, created_at: Date.now() };
  await db.works_local.add(work); // Instant local write
  if (isAuthenticated()) {
    await writeBuffer.enqueue({ table: "works", op: "insert", payload: work });
  }
  return work;
}
```

**Key**: Instant UI update (0ms), background sync

### 2. `*.electric.ts` - Electric Shape Subscriptions

**Purpose**: Subscribe to Postgres via Electric SSE streams

```typescript
export function useWorksSync(userId?: string) {
  return useShape<Work>({
    table: "works",
    where: userId ? `owner_id = '${userId}'` : "1 = 0", // Never match for guests
  });
}
```

**Key**: Called once by `SyncManager`, writes to Dexie `works` table

### 3. `*.merged.ts` - Query Layer (Public Hook)

**Purpose**: Merge synced + local data for UI queries

```typescript
export function useWorks() {
  const { data: synced } = useLiveQuery(() => db.works.toArray());
  const { data: local } = useLiveQuery(() => db.works_local.toArray());

  return useMemo(() => {
    const map = new Map(synced?.map((w) => [w.id, w]));
    local?.forEach((w) => map.set(w.id, w)); // Local overrides synced
    return Array.from(map.values());
  }, [synced, local]);
}
```

**Key**: This is what components call

### 4. `*.cleanup.ts` - Remove Synced Local Changes

**Purpose**: Clean up `*_local` table after sync confirmation

```typescript
export async function cleanupWorks() {
  const synced = await db.works.toArray();
  const local = await db.works_local.toArray();

  const syncedIds = new Set(synced.map((w) => w.id));
  const toDelete = local.filter((w) => syncedIds.has(w.id));

  await db.works_local.bulkDelete(toDelete.map((w) => w.id));
}
```

**Key**: Called periodically to prevent duplicate data

---

## WriteBuffer Architecture

**Purpose**: Queue local changes for background sync to server

**Interface**:

```typescript
interface WriteBuffer {
  enqueue(change: WriteChange): Promise<WriteChange>;
  flush(): Promise<void>; // Manual flush
  size(): Promise<number>;
}

interface WriteChange {
  id: string; // UUID
  table: string; // "works", "assets", etc.
  op: "insert" | "update" | "delete";
  payload: any; // Validated data
  status: "pending" | "syncing" | "applied" | "error";
  retry_count: number;
}
```

**Background Worker**: Auto-flushes every 5 seconds (configurable)

---

## Guest vs Authenticated Mode

### Guest Mode

- ✅ Instant local writes (`*.local.ts`)
- ❌ No WriteBuffer enqueue (`isAuthenticated()` check)
- ❌ No Electric sync (`userId = undefined`)
- **Result**: Fully functional offline, no sync

### Authenticated Mode

- ✅ Instant local writes
- ✅ WriteBuffer enqueue → background sync
- ✅ Electric sync via SSE
- **Result**: Local-first + real-time sync

---

## Key Principles

1. **4 Files Per Entity** - Local, Electric, Merged, Cleanup
2. **Instant Local Writes** - Always write to Dexie first (0ms UI update)
3. **Background Sync** - WriteBuffer + Electric handle server coordination
4. **SyncManager Pattern** - One component calls all `*Sync()` hooks (avoid race conditions)
5. **Merge Layer** - `*.merged.ts` hooks combine synced + local for UI
6. **Guest Support** - Skip WriteBuffer enqueue when `isAuthenticated() === false`

---

## See Also

- [`GUIDE_DATA_ARCHITECTURE.md`](GUIDE_DATA_ARCHITECTURE.md) - Complete architecture (layers, CAS, platform injection)
- [`GUIDE_OPTIMISTIC_UPDATES.md`](GUIDE_OPTIMISTIC_UPDATES.md) - Implementation patterns and critical checks
- Source code: `packages/data/src/repos/works.*.ts` - Reference implementation
