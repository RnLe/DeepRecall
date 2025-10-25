# Sync Architecture Guide

## Overview

DeepRecall uses a **two-layer architecture** for instant UX with durable sync:

- **Local layer** (`*_local` tables in Dexie) - Optimistic updates (0ms response)
- **Synced layer** (`*` tables in Dexie) - Electric shapes from Postgres (durable)

Components query a **merged view** that combines both layers.

## The Critical Rule: One Writer Per Synced Table

**Problem:** Multiple components subscribing to Electric shapes → multiple writers to Dexie → race conditions.

**Solution:** Centralize sync logic in a single `SyncManager` component.

## Architecture Pattern

```
<App Root>
  <SyncManager />          ← Calls sync hooks (writes to Dexie)
  └── <Pages/Components>   ← Call read hooks (reads from Dexie)
```

### Sync Hooks (Internal - Called Once)

Located in `/packages/data/src/hooks/use*.ts`

```typescript
// Called ONLY by SyncManager
export function usePresetsSync() {
  const electricResult = presetsElectric.usePresets();

  useEffect(() => {
    if (electricResult.isFreshData && electricResult.data) {
      syncElectricToDexie(electricResult.data);
    }
  }, [electricResult.data, electricResult.isFreshData]);

  return null;
}
```

**Responsibilities:**

- Subscribe to Electric shape
- Sync shape data to Dexie synced table (`presets`)
- Run cleanup on local table (`presets_local`)

### Read Hooks (Public - Called Many Times)

```typescript
// Called by any component
export function usePresets() {
  return useQuery({
    queryKey: ["presets", "merged"],
    queryFn: () => presetsMerged.getAllMergedPresets(),
    staleTime: 0,
  });
}
```

**Responsibilities:**

- Query merged view from Dexie (synced + local)
- Return React Query result
- **No side effects!**

## Data Flow

### Write Path (User Action)

```
User clicks "Create Preset"
  ↓
1. Write to presets_local (Dexie)      ← Instant UI update (0ms)
2. Enqueue to WriteBuffer
3. Flush to Postgres
4. Electric syncs back
5. SyncManager updates presets (Dexie) ← ONE writer
6. SyncManager cleans up presets_local
```

### Read Path (Component Render)

```
Component calls usePresets()
  ↓
Query Dexie merged view:
  - SELECT * FROM presets (synced)
  - UNION SELECT * FROM presets_local (pending)
  - Dedupe by ID (local overrides synced)
  ↓
Return merged array
```

## Common Mistakes to Avoid

### ❌ Wrong: Side Effects in Read Hooks

```typescript
export function usePresets() {
  const electric = presetsElectric.usePresets();

  useEffect(() => {
    syncToMongo(electric.data); // ❌ Race condition!
  }, [electric.data]);

  return mergeDexieData();
}
```

### ✅ Right: Separate Sync and Read

```typescript
// Sync hook (called once)
function usePresetsSync() {
  const electric = presetsElectric.usePresets();
  useEffect(() => {
    if (electric.isFreshData) syncToDexie(electric.data);
  }, [electric.data]);
  return null;
}

// Read hook (called many times)
export function usePresets() {
  return useQuery({
    queryKey: ["presets"],
    queryFn: () => presetsMerged.getAllMergedPresets(),
  });
}
```

## Hook Design Checklist

When creating a new entity hook:

- [ ] **Sync hook** (`use<Entity>Sync`) - internal, runs side effects
- [ ] **Read hook** (`use<Entity>`) - public, queries Dexie only
- [ ] Register sync hook in `SyncManager`
- [ ] Export only read hook from `/packages/data`
- [ ] Ensure `isFreshData` check before syncing
- [ ] Never sync to Dexie from component-level hooks

## Why This Pattern?

**Before (Broken):**

- 5 components use `usePresets()`
- Each syncs Electric → Dexie
- Race condition: they overwrite each other
- Result: Data disappears randomly

**After (Fixed):**

- 1 `SyncManager` uses `usePresetsSync()`
- 5 components use `usePresets()` (read-only)
- One writer, many readers
- Result: Reliable sync

## File Locations

- **Sync hooks:** `/packages/data/src/hooks/use*.ts` (internal)
- **SyncManager:** `/apps/web/app/providers.tsx`
- **Read hooks:** Exported from `/packages/data/src/index.ts`
- **Merge repos:** `/packages/data/src/repos/*.merged.ts`

## Key Principle

> **Global shared state (Dexie synced tables) must have exactly ONE writer.**
>
> Multiple readers are fine. Multiple writers create race conditions.

---

_This pattern ensures instant optimistic updates (0ms) while preventing sync race conditions._
