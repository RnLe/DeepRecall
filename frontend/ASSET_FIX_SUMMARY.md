# Asset Mental Model - Changes Summary

## Problem

Assets were not disappearing from "Unlinked Assets" after being linked to Activities.

## Root Cause

**Mental model violation**: Assets (local Dexie data) were queried with React Query instead of useLiveQuery, causing reactivity issues.

## Solution

Applied the correct mental model:

- **Blobs** (server data) → React Query ✓
- **Assets** (Dexie data) → useLiveQuery ✓
- **Edges** (Dexie data) → automatically tracked by useLiveQuery ✓

---

## Files Changed

### 1. `/src/hooks/useBlobs.ts` - Core Fix

**Changed:**

- `useUnlinkedAssets()` from `useQuery` → `useLiveQuery`
- `useOrphanedAssets()` inline async function for clarity

**Added:**

- 20+ lines of mental model documentation in file header
- Inline comments explaining Asset vs Blob distinction
- Comments about linking states

**Result:** UI now auto-updates when edges change, no manual invalidation needed

---

### 2. `/app/library/page.tsx` - Removed Manual Invalidations

**Removed:**

- 4 instances of `queryClient.invalidateQueries({ queryKey: ["unlinkedAssets"] })`

**Added:**

- Comments explaining why invalidation is no longer needed
- Notes about useLiveQuery handling reactivity automatically

**Functions updated:**

- `handleDropBlobToActivity`
- `handleDropAssetToActivity`
- `handleUnlinkAssetFromActivity`
- LinkBlobDialog `onSuccess` callback

---

### 3. `/app/library/FileInbox.tsx` - Fixed Hook Usage

**Changed:**

- `const { data: unlinkedAssets } = useUnlinkedAssets()`
- → `const unlinkedAssets = useUnlinkedAssets()`
  (useLiveQuery returns data directly, not wrapped in `{data}`)

**Updated:**

- LinkBlobDialog success callback to remove unlinkedAssets invalidation
- Added comment about automatic updates

---

### 4. `/src/schema/library.ts` - Mental Model Documentation

**Added:**

- 30+ line comment block before `AssetSchema`
- Explained Asset vs Blob distinction
- Documented three linking states (version-linked, edge-linked, unlinked)
- Clarified versionId optionality and edge-based linking

---

### 5. `/src/schema/blobs.ts` - Blob Documentation

**Added:**

- File header explaining Blob mental model
- Contrast with Assets
- Server vs client storage distinction

---

### 6. `/src/repo/assets.ts` - Repository Documentation

**Added:**

- Mental model header explaining Asset lifecycle
- Three linking states documented
- Operations explained (create, link, unlink, delete)

---

### 7. `/src/repo/edges.ts` - Edge Documentation

**Added:**

- Mental model header for edges
- Special documentation about Asset linking via "contains" edges
- Example edge structure for Activities containing Assets

---

### 8. `/app/library/ActivityBanner.tsx` - Drop Behavior Comments

**Added:**

- Inline comments in `handleDrop` explaining:
  - Blob drop: creates Asset then links
  - Asset drop: just creates edge (Asset already exists)
  - How edge creation changes Asset state

---

### 9. `/ASSET_MENTAL_MODEL.md` - New Comprehensive Guide

**Created:** 250+ line documentation covering:

- Problem and root cause
- Blob vs Asset distinction
- Three Asset linking states
- Data flow diagrams
- Code organization
- Testing checklist
- Common pitfalls
- Mental model boundaries table

---

## Key Concepts Added Throughout

### 1. Asset vs Blob Distinction

```
Blob (Server):              Asset (Client):
- SQLite on server          - Dexie in browser
- SHA-256 identity          - UUID identity
- Immutable CAS             - Mutable metadata
- Raw file                  - References blob + semantic info
```

### 2. Asset Linking States

```
1. Version-linked:   Has versionId       → Part of Work
2. Edge-linked:      No versionId + edge → In Activity/Collection
3. Unlinked:         No versionId + no edges → Needs linking
```

### 3. Reactivity Pattern

```
Before (❌):                After (✅):
React Query                 useLiveQuery
+ manual invalidation       = automatic updates
```

---

## Testing Verification

Run these scenarios to verify the fix:

1. ✅ Drag blob to Activity → Asset disappears from "Unlinked Assets" immediately
2. ✅ Drag unlinked Asset to Activity → Asset disappears immediately
3. ✅ Unlink Asset from Activity → Asset reappears immediately
4. ✅ Link blob to Work → Asset never appears in "Unlinked Assets"
5. ✅ No console errors or warnings

---

## Mental Model Alignment

| Before                            | After                            |
| --------------------------------- | -------------------------------- |
| Assets mixed with React Query     | Assets properly use useLiveQuery |
| Manual invalidations everywhere   | Automatic Dexie reactivity       |
| Unclear Blob vs Asset distinction | Clear separation with docs       |
| Fragile query dependencies        | Single source of truth           |

---

## Lines of Code

- **Documentation added:** ~400 lines
- **Code changed:** ~50 lines
- **Code removed:** ~20 lines (invalidations)
- **Net impact:** More maintainable, self-documenting codebase

---

## Related Files (Not Changed, For Reference)

These files use the correct patterns already:

- `/src/hooks/useLibrary.ts` - Uses useLiveQuery for Works, Versions
- `/src/db/dexie.ts` - Database schema definition
- `/app/library/CreateWorkDialog.tsx` - Links Assets to Versions
- `/app/library/LinkBlobDialog.tsx` - Creates Assets from Blobs

---

## Conclusion

✅ **Bug fixed**: Assets now disappear from "Unlinked Assets" immediately after linking  
✅ **Mental model applied**: Clear Blob vs Asset distinction throughout codebase  
✅ **Code simplified**: Removed manual invalidations, rely on Dexie reactivity  
✅ **Well documented**: Every relevant file now explains the mental model  
✅ **Future-proof**: Next developer can understand and maintain this easily

The codebase now consistently follows the architectural principles from MentalModels.md.
