# Debugging Guide

## Current Issues

### 1. Library Not Loading (CRITICAL)

**Symptoms:**

- `useWorksExtended()` returns `undefined` indefinitely
- Browser console shows: "Library page: Loading..." repeatedly
- Works never load

**Possible Causes:**

1. **Dexie database migration issue** - Version 2 upgrade adding `presetId` indexes may be hanging
2. **Browser IndexedDB corruption** - Old data incompatible with new schema
3. **useLiveQuery stuck** - Query not completing

**Debugging Steps:**

1. Open browser DevTools → Application → IndexedDB → DeepRecallDB
2. Check if database exists and has correct version (should be 2)
3. Check browser console for errors during migration
4. Try the "Clear DB" button to reset

**Fix:**

- Click "Clear DB" button next to "Scan" in Library header
- This will delete all data and recreate the database with version 2
- After clearing, scan your files again to repopulate

### 2. Template Labels Only Show for Textbooks

**Symptoms:**

- Only works created with "Textbook" template show labels
- Other templates (Paper, Thesis, Script, Slides) don't show labels

**Root Cause:**

- **Expected behavior for old works**: Works created BEFORE we added `presetId` field don't have it set
- Only NEWLY created works will have template labels
- If you only created one work recently (with Textbook template), that's why only it shows

**Test:**

1. Create a new work with "Paper" template
2. Create another with "Thesis" template
3. Both should show their respective colored labels

**Debugging:**

```javascript
// In browser console:
const db = await new Promise((resolve) => {
  const request = indexedDB.open("DeepRecallDB");
  request.onsuccess = () => resolve(request.result);
});

const tx = db.transaction(["works"], "readonly");
const works = await new Promise((resolve) => {
  const req = tx.objectStore("works").getAll();
  req.onsuccess = () => resolve(req.result);
});

// Check which works have presetId
works.forEach((w) => console.log(w.title, "→ presetId:", w.presetId));
```

### 3. Docker Connection Reset Errors

**Symptoms:**

```
Failed to load resource: net::ERR_CONNECTION_RESET
Unable to add filesystem: <illegal path>
```

**Root Cause:**

- Next.js dev server (Turbopack) hot reload issues
- Not critical - usually recovers automatically

**Fix:**

- Restart docker containers: `docker compose restart frontend`
- Hard refresh browser: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

## Database Schema Version 2 Changes

### What Changed:

- Added `presetId` field to `Work`, `Version`, and `Asset` schemas
- Added database indexes for efficient preset lookup:
  - `works`: Added `presetId` index
  - `versions`: Added `presetId` index
  - `assets`: Added `presetId` index

### Migration:

- **Automatic** via Dexie version upgrade
- **Non-destructive** - existing records remain valid (presetId is optional)
- No data transformation needed

### If Migration Fails:

1. Click "Clear DB" button (red trash icon next to "Scan")
2. Confirm deletion (⚠️ THIS DELETES ALL DATA)
3. Page reloads with fresh database
4. Scan files again to repopulate

## Verification Checklist

After clearing database and restarting:

- [ ] Library page loads and shows works
- [ ] Can create work with "Paper" template → shows Paper label
- [ ] Can create work with "Textbook" template → shows Textbook label
- [ ] Can create work with "Thesis" template → shows Thesis label
- [ ] Can drag unlinked asset to work → asset disappears from unlinked list
- [ ] Can drag unlinked asset to activity → asset disappears from unlinked list
- [ ] Removing asset from activity → asset reappears in unlinked list (expected!)

## Console Debugging Commands

```javascript
// Check database version
const request = indexedDB.open("DeepRecallDB");
request.onsuccess = () => console.log("DB Version:", request.result.version);

// Check all works with presetId
import { db } from "@/src/db/dexie";
const works = await db.works.toArray();
console.table(works.map((w) => ({ title: w.title, presetId: w.presetId })));

// Check all presets
const presets = await db.presets.toArray();
console.table(presets.map((p) => ({ id: p.id, name: p.name })));

// Check if works reference valid presets
for (const work of works) {
  if (work.presetId) {
    const preset = await db.presets.get(work.presetId);
    console.log(`${work.title} → ${preset?.name || "PRESET NOT FOUND"}`);
  }
}
```

## Quick Fixes

### Reset Everything:

1. Click "Clear DB" button in Library header
2. Confirm deletion
3. Page reloads
4. Click "Scan" to repopulate from files

### Create Test Work:

1. Click "+ Work" button
2. Select a template (Paper/Textbook/Thesis)
3. Fill in title
4. Click "Create Work"
5. Check if colored label appears

### Check Asset Linking:

1. Upload a PDF (should appear in "New Files")
2. Drag it to "Unlinked Assets" area
3. Drag the asset from unlinked to a work card
4. Asset should disappear from unlinked list
5. Asset should appear in work's versions
