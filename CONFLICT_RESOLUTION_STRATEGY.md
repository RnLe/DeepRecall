# Conflict Resolution Strategy

> **How to handle concurrent edits across devices before data loss occurs**

## The Problem

**Scenario**:

1. Device A (offline) edits board → adds 5 strokes
2. Device B (offline) edits same board → adds 3 strokes
3. Device A goes online → writes to Postgres
4. Device B goes online → reads from Electric → **overwrites local changes**

**Current behavior**: Last device to sync wins, earlier changes lost ❌

## The Solution: Pre-Merge Conflict Detection

**Insert conflict detection AFTER Electric sync, BEFORE Dexie merge**

```
Electric data arrives → Detect conflicts → Auto-resolve or copy → Write to Dexie
```

---

## Conflict Categories

### ✅ Auto-Mergeable (No User Intervention)

**Additive operations** across different devices:

| Entity          | Conflict                                                 | Resolution                         |
| --------------- | -------------------------------------------------------- | ---------------------------------- |
| **Boards**      | Device A adds stroke 1-5, Device B adds stroke 6-8       | Combine all strokes (merge arrays) |
| **Annotations** | Device A adds note, Device B adds different note         | Keep both (different IDs)          |
| **Cards**       | Device A creates card X, Device B creates card Y         | Keep both (different IDs)          |
| **Works**       | Device A adds tag "physics", Device B adds tag "quantum" | Merge tags array                   |

**Implementation**:

```typescript
function autoMergeStrokes(
  electricStrokes: Stroke[],
  localStrokes: Stroke[]
): Stroke[] {
  // Merge by unique stroke ID
  const merged = new Map<string, Stroke>();

  for (const stroke of [...electricStrokes, ...localStrokes]) {
    merged.set(stroke.id, stroke);
  }

  return Array.from(merged.values());
}
```

---

### ⚠️ Requires Conflict Copies (Conflicting Edits)

**Mutating operations** on the same entity field:

| Entity          | Conflict                                                                   | Resolution                                        |
| --------------- | -------------------------------------------------------------------------- | ------------------------------------------------- |
| **Annotations** | Device A changes title to "Key Point", Device B changes to "Important"     | Create copy: "Key Point (Conflict from Device B)" |
| **Cards**       | Device A changes answer, Device B changes same answer                      | Create copy with both versions                    |
| **Works**       | Device A renames to "QM Textbook", Device B renames to "Quantum Mechanics" | Keep latest by timestamp, notify user             |

**Implementation**:

```typescript
function handleConflictingEdits<T extends { id: string; updatedAt: string }>(
  electricData: T,
  localChange: LocalChange
): T[] {
  const electricTime = new Date(electricData.updatedAt).getTime();
  const localTime = new Date(localChange.updatedAt).getTime();

  if (Math.abs(electricTime - localTime) < 5000) {
    // Changes within 5 seconds → likely conflict

    if (canAutoMerge(electricData, localChange)) {
      return [autoMerge(electricData, localChange)];
    }

    // Create conflict copy
    const conflictCopy = {
      ...localChange.data,
      id: uuid(),
      title: `${localChange.data.title} (Conflict from ${getDeviceName()})`,
    };

    return [electricData, conflictCopy];
  }

  // Not a conflict - one clearly happened after the other
  return [electricTime > localTime ? electricData : localChange.data];
}
```

---

## Implementation: Update Sync Hooks

**Pattern for ALL entities** (`packages/data/src/hooks/use*.ts`):

```typescript
export function useAnnotationsSync() {
  const electricResult = annotationsElectric.useAnnotations();

  useEffect(() => {
    if (!electricResult.isLoading && electricResult.data) {
      (async () => {
        // 1. Get pending local changes
        const localChanges = await db.annotations_local.toArray();

        // 2. Detect conflicts
        const conflicts = detectConflicts(electricResult.data, localChanges);

        // 3. Resolve conflicts
        const resolvedData = [...electricResult.data];
        const conflictCopies: Annotation[] = [];

        for (const conflict of conflicts) {
          if (canAutoMerge(conflict)) {
            // Merge in-place
            const merged = autoMerge(conflict.electric, conflict.local);
            const idx = resolvedData.findIndex((a) => a.id === conflict.id);
            resolvedData[idx] = merged;
          } else {
            // Create conflict copy
            const copy = createConflictCopy(conflict.local);
            conflictCopies.push(copy);
          }
        }

        // 4. Write to Dexie
        await db.annotations.bulkPut([...resolvedData, ...conflictCopies]);

        // 5. Cleanup local (only non-conflicted changes)
        const cleanupIds = localChanges
          .filter((lc) => !conflicts.some((c) => c.id === lc.id))
          .map((lc) => lc.id);
        await db.annotations_local.bulkDelete(cleanupIds);
      })();
    }
  }, [electricResult.isLoading, electricResult.data]);
}
```

---

## Conflict Detection Utility

**Location**: `packages/data/src/utils/conflicts.ts` (new file)

```typescript
import type { LocalChange } from "../db/dexie";

export interface Conflict<T = any> {
  id: string;
  type: "merge" | "copy";
  electric: T;
  local: LocalChange;
  reason: string;
}

/**
 * Detect conflicts between Electric data and local changes
 */
export function detectConflicts<T extends { id: string; updatedAt: string }>(
  electricData: T[],
  localChanges: LocalChange[]
): Conflict<T>[] {
  const conflicts: Conflict<T>[] = [];
  const electricMap = new Map(electricData.map((d) => [d.id, d]));

  for (const local of localChanges) {
    if (local._op === "delete") {
      // Deletion conflicts handled separately
      continue;
    }

    const electric = electricMap.get(local.id);
    if (!electric) {
      // New item, no conflict
      continue;
    }

    // Compare timestamps
    const electricTime = new Date(electric.updatedAt).getTime();
    const localTime = new Date(local.updatedAt).getTime();
    const timeDiff = Math.abs(electricTime - localTime);

    if (timeDiff < 5000) {
      // Changes within 5 seconds → potential conflict
      const conflictType = canAutoMerge(electric, local) ? "merge" : "copy";

      conflicts.push({
        id: local.id,
        type: conflictType,
        electric,
        local,
        reason: `Concurrent edit (${timeDiff}ms apart)`,
      });
    }
  }

  return conflicts;
}

/**
 * Check if conflict can be auto-merged
 */
export function canAutoMerge<T>(electric: T, local: LocalChange): boolean {
  const entityType = local.table;

  // Strokes/Boards: Always mergeable (additive)
  if (entityType === "strokes" || entityType === "boards") {
    return true;
  }

  // Annotations/Cards: Check if different fields edited
  if (entityType === "annotations" || entityType === "cards") {
    const electricData = electric as any;
    const localData = local.data as any;

    // Get changed fields
    const electricFields = Object.keys(electricData).filter(
      (k) => electricData[k] !== localData[k]
    );

    // If no overlap in changed fields, can merge
    return electricFields.length === 0;
  }

  // Default: Cannot auto-merge
  return false;
}

/**
 * Auto-merge non-conflicting changes
 */
export function autoMerge<T>(electric: T, local: LocalChange): T {
  const entityType = local.table;

  if (entityType === "strokes") {
    // Merge stroke arrays by ID
    const electricStrokes = (electric as any).strokes || [];
    const localStrokes = (local.data as any).strokes || [];

    const merged = new Map();
    for (const stroke of [...electricStrokes, ...localStrokes]) {
      merged.set(stroke.id, stroke);
    }

    return {
      ...electric,
      strokes: Array.from(merged.values()),
    } as T;
  }

  // For other types, merge changed fields
  return {
    ...electric,
    ...local.data,
    updatedAt: new Date().toISOString(),
  } as T;
}

/**
 * Create conflict copy with descriptive name
 */
export function createConflictCopy<T extends { id: string }>(
  local: LocalChange
): T {
  const deviceName = getDeviceName(); // "Desktop", "iPhone", etc.
  const originalTitle =
    (local.data as any).title || (local.data as any).name || "Item";

  return {
    ...local.data,
    id: uuid(),
    title: `${originalTitle} (Conflict from ${deviceName})`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as T;
}

function getDeviceName(): string {
  // Get from device_id utility
  return "Device"; // placeholder
}

function uuid(): string {
  return crypto.randomUUID();
}
```

---

## Testing Scenarios

### Scenario 1: Concurrent Strokes (Auto-Merge) ✅

1. Device A (offline): Add 3 strokes to board
2. Device B (offline): Add 2 different strokes to same board
3. Device A goes online → syncs
4. Device B goes online → **expects to see 5 strokes total**

**Expected**: All 5 strokes visible on both devices

---

### Scenario 2: Concurrent Title Edits (Conflict Copy) ⚠️

1. Device A (offline): Change annotation title to "Key Insight"
2. Device B (offline): Change same annotation title to "Important Point"
3. Device A goes online → syncs
4. Device B goes online → **expects to see both versions**

**Expected**:

- Original annotation with "Key Insight" (from A)
- New annotation "Important Point (Conflict from Device B)"

---

### Scenario 3: Sequential Edits (No Conflict) ✅

1. Device A: Change annotation title to "First"
2. Device A syncs → Postgres timestamp: 12:00:00
3. Device B: Change same annotation to "Second"
4. Device B syncs → Postgres timestamp: 12:05:30

**Expected**: Last edit wins ("Second"), no conflict copy created

---

## Rollout Plan

### Phase 1: Detection Only (Week 1)

- Implement conflict detection utility
- Add logging to all sync hooks
- Monitor production for conflict frequency
- **No user-facing changes yet**

### Phase 2: Auto-Merge (Week 2)

- Enable auto-merge for strokes/boards
- Test with concurrent drawing on multiple devices
- Validate merge correctness

### Phase 3: Conflict Copies (Week 3)

- Enable conflict copy creation for annotations/cards
- Add UI indicator for conflict copies
- Test title/content edit conflicts

### Phase 4: User Resolution UI (Future)

- Add conflict resolution modal
- Let user choose which version to keep
- Implement 3-way merge for text fields

---

## Success Criteria

✅ **Auto-merge works**: Concurrent strokes on same board merge correctly  
✅ **No data loss**: Conflicting edits create copies, both visible  
✅ **Performance**: Conflict detection adds <100ms to sync time  
✅ **Monitoring**: Conflict rate logged and tracked

---

_Priority: Implement Phase 1 (detection + logging) immediately to understand conflict patterns in production._
