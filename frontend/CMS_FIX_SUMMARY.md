# CMS Domain Structure Fixes

## Issues Fixed

### Issue 1: Work Cards Not Showing Template Label

**Problem:** Work cards were not displaying the preset/template name and color, even though the template system was working.

**Root Cause:** When creating a work via `LinkBlobDialog`, the `presetId` field was not being passed to the work object, even though a preset was selected.

**Fix:** Updated `LinkBlobDialog.tsx` (line 117) to include `presetId: selectedPreset.id` in the work creation payload.

**Files Changed:**

- `/home/renlephy/DeepRecall/frontend/app/library/LinkBlobDialog.tsx`

---

### Issue 2: Asset Linking/Unlinking Not Working Properly

**Problem:**

1. When linking an unlinked Asset to a work, it didn't disappear from the "Unlinked Assets" list
2. When unlinking an Asset from an Activity, it appeared duplicated in the "Unlinked Assets" list

**Root Cause:** The `useUnlinkedAssets()` hook was potentially creating duplicate entries in the returned array. While the filtering logic was correct (exclude assets with `versionId` or "contains" edges), the array construction could result in duplicates if the same asset appeared multiple times in the query results.

**Fix:** Modified `useUnlinkedAssets()` in `/home/renlephy/DeepRecall/frontend/src/hooks/useBlobs.ts` to use a `Map<string, Asset>` for deduplication before returning the final array. This ensures each asset appears only once, even if the underlying Dexie query returns duplicates.

**Files Changed:**

- `/home/renlephy/DeepRecall/frontend/src/hooks/useBlobs.ts`

---

## Domain Structure Clarification

Updated `MentalModels.md` to clearly document the library/CMS domain structure:

### Entity Hierarchy

1. **Blob** (Server SQLite)
   - Minimal file object for data movement between website and hard disk
   - Content-addressed by SHA-256 hash
   - Lives in server SQLite database
   - Immutable, rename-proof storage

2. **Asset** (Client Dexie)
   - Metadata entity referencing a Blob via SHA-256
   - Has its own lifecycle separate from Blobs
   - Three states:
     - **Version-linked**: Has `versionId` → Part of a Work
     - **Edge-linked**: No `versionId`, has "contains" edges → In Activity/Collection
     - **Unlinked**: No `versionId`, no edges → Needs linking (shows in "Unlinked Assets")
   - Carries role, filename, semantic metadata
   - "Data entities" that can be moved and linked

3. **Version**
   - Child of Work; concrete edition/revision
   - **Note:** Versions will be migrated into Assets in future refactoring

4. **Work**
   - Conceptual metadata container (textbook/paper identity)
   - NOT a file directly—everything derives from Assets/Blobs
   - Abstract intellectual entity

5. **Activity**
   - Larger container (course/project/thesis)
   - Links Works and Assets via Edges with `relation="contains"`

6. **Collection**
   - Curation/grouping mechanism (future feature)

### Key Principles

**Blob vs Asset Distinction:**

- **Blob** = Raw file on server (immutable storage)
- **Asset** = Metadata in client that _references_ a Blob
- Multiple Assets can reference the same Blob
- Assets can be unlinked, moved, or deleted without affecting the Blob

**Asset Lifecycle:**

- Create: `createAsset()` → New Asset entity in Dexie
- Link to Work: Set `versionId` → Asset becomes part of a Work/Version
- Link to Activity: Create Edge with `relation="contains"` → Asset linked via graph
- Unlink from Activity: Delete Edge → Asset becomes "unlinked" again
- Delete: `deleteAsset()` → Remove Asset entity (Blob remains on server)

**Data Ownership (Mental Model):**

- Server (SQLite via Drizzle) owns **Blobs** → React Query for queries
- Client (Dexie) owns **Assets, Works, Versions, Activities, Collections** → useLiveQuery for live updates
- **Edges** link entities together via typed relations

### UI States

**"New Files (Inbox)":**

- Shows Blobs without Assets (`useOrphanedBlobs()`)
- These are files detected on disk but never processed into the library
- Uses React Query (server data)

**"Unlinked Assets":**

- Shows Assets without `versionId` AND without "contains" edges (`useUnlinkedAssets()`)
- These are Assets that exist in Dexie but aren't connected to any Work or Activity
- Uses useLiveQuery (client data, auto-updates)

---

## Mental Model Validation

### Zustand ↔ React Query ↔ Dexie Boundaries

✅ **Correct separation maintained:**

- **Server/remote data** (Blobs) → **React Query**
- **Local durable data** (Assets, Works, Versions, Activities) → **Dexie + useLiveQuery**
- **Ephemeral/UI state** (modals, selections, filters) → **Zustand**

✅ **No ownership duplication:**

- Blobs queried from server, never stored in Dexie
- Assets stored in Dexie, never duplicated in Zustand
- Presets stored in Dexie, queried via useLiveQuery

✅ **Invalidation strategy:**

- React Query invalidation for server data (`orphanedBlobs`, `blobs`)
- useLiveQuery auto-updates for Dexie changes (no manual invalidation needed)
- Zustand actions for UI state changes

---

## Testing Checklist

After these fixes, verify:

### Work Template Labels

- [ ] Create a new work using a preset via "Link File to Library"
- [ ] Verify the work card shows the preset name and color badge
- [ ] Check that existing works without `presetId` don't crash (show no badge)

### Asset Linking

- [ ] Drop an unlinked asset onto a work card
- [ ] Verify the asset disappears from "Unlinked Assets" immediately
- [ ] Check that the asset appears in the work's version
- [ ] Verify no duplicates appear in "Unlinked Assets"

### Asset Unlinking from Activity

- [ ] Create an activity and link an asset to it
- [ ] Verify the asset disappears from "Unlinked Assets"
- [ ] Unlink the asset from the activity
- [ ] Verify the asset reappears in "Unlinked Assets" (ONCE, not duplicated)

### Blob to Asset Flow

- [ ] Drop a new file (blob) onto an activity banner
- [ ] Verify an asset is created and linked to the activity
- [ ] Verify the blob disappears from "New Files (Inbox)"
- [ ] Verify the asset does NOT appear in "Unlinked Assets" (it's edge-linked)

---

## Future Refactoring Notes

1. **Version Migration:** Versions should eventually be absorbed into Assets. Consider:
   - Assets already have `versionNumber`, `role`, and `metadata` fields
   - Version-specific metadata (publication date, publisher, DOI) can move to Asset metadata
   - This would simplify the hierarchy: Work → Assets (instead of Work → Versions → Assets)

2. **Edge Relations:** The `Edge` schema with typed relations is powerful. Expand it for:
   - `cites` relations between Works (citation graph)
   - `prerequisite` relations for course dependencies
   - `references` for general cross-references

3. **Asset Thumbnails:** Consider storing thumbnail data URLs in Asset metadata for quick preview without fetching blobs

4. **Preset Templates:** Expand preset system to include:
   - Default values for custom metadata fields
   - Validation rules for required fields
   - Color schemes per preset for visual organization

---

## Code Quality Notes

✅ **Type Safety:** All entities use Zod schemas with inferred TypeScript types
✅ **Validation:** Schema validation at boundaries (Dexie inserts, API responses)
✅ **Idempotency:** UUIDs ensure deterministic entity IDs
✅ **Transactions:** Multi-table operations wrapped in Dexie transactions
✅ **Live Updates:** useLiveQuery ensures UI stays in sync with Dexie changes

---

## Files Modified

1. `/home/renlephy/DeepRecall/frontend/app/library/LinkBlobDialog.tsx`
   - Added `presetId` to work creation

2. `/home/renlephy/DeepRecall/frontend/src/hooks/useBlobs.ts`
   - Fixed `useUnlinkedAssets()` to deduplicate results using Map

3. `/home/renlephy/DeepRecall/frontend/MentalModels.md`
   - Added "Library/CMS Domain Structure" section
   - Clarified Blob vs Asset distinction
   - Documented entity hierarchy and lifecycle

---

## Mental Model Summary (TL;DR)

**Data Flow:**

```
Disk Files → Blobs (Server SQLite) → Assets (Client Dexie) → Works/Activities
```

**Entity States:**

- **Blob:** Detected on disk, immutable storage
- **Asset (Unlinked):** Created from Blob, not connected
- **Asset (Version-linked):** Has `versionId`, part of a Work
- **Asset (Edge-linked):** Has "contains" edges, part of Activity/Collection

**UI Sections:**

- **"New Files":** Blobs without Assets (never touched)
- **"Unlinked Assets":** Assets without connections (needs linking)
- **Works Grid:** Works with Versions and Assets
- **Activity Banners:** Activities with linked Works and Assets

**Key Insight:** Assets are "data entities" that outlive their connections. You can unlink an Asset without deleting it. This allows flexible reorganization of your library without data loss.
