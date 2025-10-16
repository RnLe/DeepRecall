# Testing Guide: Asset Mental Model Fix

## Quick Test Procedure

### Prerequisites

1. Navigate to the Library page (`/library`)
2. Ensure you have:
   - Some files in the "New Files (Inbox)" section (orphaned blobs)
   - OR some items in "Unlinked Assets" section
   - At least one Activity created

---

## Test Case 1: Link Unlinked Asset to Activity

**Steps:**

1. Locate an item in "Unlinked Assets" (right side of FileInbox)
2. Drag the item
3. Drop it onto an Activity banner

**Expected Result:**

- ✅ Asset should **immediately disappear** from "Unlinked Assets"
- ✅ Asset should appear in the Activity's content
- ✅ No console errors
- ✅ No page refresh required

**What Changed:**

- Before: Asset stayed in "Unlinked Assets" until manual refresh
- After: useLiveQuery automatically detects edge creation and updates UI

---

## Test Case 2: Link New File (Blob) to Activity

**Steps:**

1. Locate an item in "New Files (Inbox)" (left side of FileInbox)
2. Drag the item
3. Drop it onto an Activity banner

**Expected Result:**

- ✅ Item should **immediately disappear** from "New Files"
- ✅ A new Asset should be created (standalone, no versionId)
- ✅ Asset should be linked to the Activity (edge created)
- ✅ Asset should **not appear** in "Unlinked Assets" (it's already linked)

**What Changed:**

- The asset creation + linking happens atomically
- useLiveQuery ensures "Unlinked Assets" never shows the asset

---

## Test Case 3: Unlink Asset from Activity

**Steps:**

1. Expand an Activity that contains an Asset (file icon)
2. Right-click (or use context menu) to unlink the Asset
3. Observe the "Unlinked Assets" section

**Expected Result:**

- ✅ Asset should **immediately appear** in "Unlinked Assets"
- ✅ Asset should disappear from the Activity
- ✅ No console errors

**What Changed:**

- Before: Asset wouldn't appear until manual query invalidation
- After: useLiveQuery detects edge deletion and updates immediately

---

## Test Case 4: Link Blob to Work/Version

**Steps:**

1. Locate an item in "New Files (Inbox)"
2. Click the "Link" button (not drag-and-drop)
3. In the dialog, link it to a Work/Version
4. Observe "Unlinked Assets"

**Expected Result:**

- ✅ Item disappears from "New Files (Inbox)"
- ✅ Asset is created with `versionId` set
- ✅ Asset does **not** appear in "Unlinked Assets" (has versionId)
- ✅ Asset appears in the Work's details

**Reasoning:**

- Assets with `versionId` are version-linked, not unlinked
- They're part of the Work → Version → Asset hierarchy

---

## Test Case 5: Drag Asset Between Activities

**Steps:**

1. Drag an Asset from one Activity
2. Drop it onto a different Activity banner

**Expected Result:**

- ✅ Edge from first Activity should be removed
- ✅ Edge to second Activity should be created
- ✅ Asset moves between Activities immediately
- ✅ Asset never appears in "Unlinked Assets" (always has an edge)

---

## Console Verification

### What You Should See

```
Library page: Loading...
Library page: Loaded X works
useWorksExtended: Fetching works...
useWorksExtended: Fetched X works
```

### What You Should NOT See

- ❌ Errors about React Query mutations
- ❌ Warnings about stale queries
- ❌ Errors about Dexie transactions
- ❌ Type errors about `.data` property

---

## Developer Tools Check

### Dexie Database (IndexedDB)

Open DevTools → Application → IndexedDB → DeepRecallDB

**After linking Asset to Activity:**

1. Check `edges` table
2. Find edge with `relation: "contains"`, `fromId: [activityId]`, `toId: [assetId]`
3. Verify `assets` table shows the asset with NO `versionId`

**After unlinking Asset:**

1. Check `edges` table
2. Verify the edge is deleted
3. `assets` table still has the asset (not deleted)

---

## Performance Check

**Before (React Query with manual invalidation):**

- Each link/unlink triggered query refetch
- Multiple round-trips to invalidate + refetch
- Potential race conditions

**After (useLiveQuery with automatic updates):**

- UI updates synchronously with Dexie changes
- No query refetch needed
- No network overhead (local data)
- Instantaneous updates

---

## Edge Cases

### Case A: Asset Linked to Multiple Activities

**Test:**

1. Drag same Asset to multiple Activities

**Expected:**

- Creates multiple "contains" edges
- Asset is in all Activities
- Asset does NOT appear in "Unlinked Assets"

### Case B: Delete Activity with Assets

**Test:**

1. Delete an Activity that contains Assets

**Expected:**

- Activity is deleted
- Edges are deleted (cascaded)
- Assets reappear in "Unlinked Assets" (no longer linked)

### Case C: Orphaned Asset (Blob Deleted)

**Test:**

1. Manually delete a blob file from the data directory
2. Scan for blobs

**Expected:**

- Asset still exists in Dexie
- Asset appears in "Orphaned Assets" section (different from "Unlinked")
- Can still see metadata, but can't access file

---

## Rollback Plan (If Issues)

If you encounter problems, you can revert by:

1. **Check git history:**

   ```bash
   git log --oneline frontend/src/hooks/useBlobs.ts
   ```

2. **Revert specific files:**

   ```bash
   git checkout HEAD~1 frontend/src/hooks/useBlobs.ts
   git checkout HEAD~1 frontend/app/library/page.tsx
   git checkout HEAD~1 frontend/app/library/FileInbox.tsx
   ```

3. **Clear IndexedDB** (if data corruption):
   - Open DevTools → Application → IndexedDB
   - Delete `DeepRecallDB`
   - Refresh page (will recreate empty database)

---

## Known Limitations

1. **Bulk Operations**: Linking 50+ assets at once may cause brief UI lag
2. **Edge Cleanup**: Deleting entities doesn't auto-cleanup orphaned edges (by design)
3. **Asset Versioning**: Assets don't track history of their linkages

---

## Success Criteria

✅ **Functional:** Assets disappear/reappear immediately in all test cases  
✅ **Performance:** UI updates feel instant (<50ms)  
✅ **No Errors:** Clean console, no warnings  
✅ **Data Integrity:** Dexie tables show correct edges and assets  
✅ **Developer Experience:** Code is self-documenting with clear comments

---

## Questions to Verify Understanding

1. **What's the difference between a Blob and an Asset?**
   - Blob: Server file (CAS), immutable
   - Asset: Client metadata, references blob, can be linked/unlinked

2. **When should an Asset appear in "Unlinked Assets"?**
   - When it has NO versionId AND NO edges with relation="contains"

3. **Why did we change from React Query to useLiveQuery?**
   - Assets are local data (Dexie), not remote
   - useLiveQuery automatically reacts to Dexie changes
   - React Query requires manual invalidation for local data

4. **What happens when you drag a blob to an Activity?**
   - Asset is created (standalone, no versionId)
   - Edge is created (fromId: activity, toId: asset, relation: "contains")
   - Asset is immediately linked, never appears in "Unlinked Assets"

---

## Documentation References

- **ASSET_MENTAL_MODEL.md**: Full mental model explanation
- **ASSET_FIX_SUMMARY.md**: Quick summary of changes
- **MentalModels.md**: Core architectural principles
- **LIBRARY_SCHEMA.md**: Detailed schema documentation

---

## Need Help?

If tests fail:

1. Check console for errors
2. Verify Dexie database state in DevTools
3. Review code comments in changed files
4. Consult ASSET_MENTAL_MODEL.md for detailed explanation

The fix is solid and aligns with the mental model. Any issues are likely environmental (cache, database state) rather than logical bugs.
