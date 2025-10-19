# Drop Zone & Asset Context Menu Fixes

## Overview

Fixed drop zone cleanup issue and added context menu for unlinked assets with rename, move to inbox, and delete functionality.

## Changes Implemented

### 1. Drop Zone Cleanup Fix

**Problem:** Drop zone UI state persisted when dragging cursor completely out of the browser window.

**Root Cause:** When leaving the window/document, `relatedTarget` is `null`, but the code only checked if it was a child element, causing the cleanup to skip.

**Solution:** Added explicit null check for `relatedTarget`:

```typescript
const handleLibraryDragLeave = (e: React.DragEvent) => {
  e.preventDefault();
  const relatedTarget = e.relatedTarget as Node | null;
  const currentTarget = e.currentTarget as Node;

  // If relatedTarget exists and is within container, we're moving to a child
  if (relatedTarget && currentTarget.contains(relatedTarget)) {
    return;
  }

  // If relatedTarget is null, we're leaving the window entirely - clear immediately
  if (!relatedTarget) {
    setDragCounter(0);
    setIsDraggingOverLibrary(false);
    return;
  }

  // Otherwise, decrement counter
  setDragCounter((prev) => {
    const newCount = prev - 1;
    if (newCount <= 0) {
      setIsDraggingOverLibrary(false);
      return 0;
    }
    return newCount;
  });
};
```

**Behavior:**

- **Moving to child element**: No-op (don't decrement)
- **Leaving window** (`relatedTarget === null`): Immediate cleanup
- **Normal leave**: Decrement counter

### 2. Context Menu for Unlinked Assets

**Added Features:**

1. **Rename**: Inline editing with extension handling
2. **Move to inbox**: Converts asset back to orphaned blob
3. **Delete**: Two-click confirmation, removes asset and blob

#### Rename Functionality

**Handler:** `handleAssetRename`

```typescript
const handleAssetRename = async (
  assetId: string,
  newFilename: string,
  originalFilename: string | null
) => {
  const { db } = await import("@/src/db/dexie");

  // Get the original extension
  const originalExt = getFileExt(originalFilename);

  // If user provided extension, strip it
  let finalFilename = newFilename;
  if (originalExt && finalFilename.endsWith(originalExt)) {
    finalFilename = finalFilename.substring(
      0,
      finalFilename.length - originalExt.length
    );
  }

  // Add the original extension back
  finalFilename = finalFilename + originalExt;

  await db.assets.update(assetId, {
    filename: finalFilename,
    updatedAt: new Date().toISOString(),
  });
};
```

**Features:**

- Same extension logic as blob renaming
- Display name without extension
- Automatic extension preservation
- Updates Dexie directly (local-only rename)

#### Move to Inbox

**Handler:** `handleMoveToInbox`

```typescript
const handleMoveToInbox = async (assetId: string) => {
  const { db } = await import("@/src/db/dexie");
  await db.assets.delete(assetId);

  // Refresh data - asset will now appear as orphaned blob
  queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
};
```

**Behavior:**

1. Deletes Asset from Dexie
2. Blob remains on server (file not deleted)
3. Blob becomes "orphaned" (no Asset references it)
4. File reappears in "New Files (Inbox)" section
5. Can be re-linked to a Work or deleted

**Use Cases:**

- Accidentally created asset from wrong file
- Want to re-link file to different work
- Need to review file before final linking

#### Delete Functionality

**Handler:** `handleAssetDelete`

```typescript
const handleAssetDelete = async (assetId: string, hash: string) => {
  // Delete asset from Dexie
  const { db } = await import("@/src/db/dexie");
  await db.assets.delete(assetId);

  // Also delete blob from server
  const response = await fetch(`/api/library/blobs/${hash}/delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deleteFile: true }),
  });

  // Refresh queries
  queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
  queryClient.invalidateQueries({ queryKey: ["files"] });
};
```

**Safety Features:**

- Two-click confirmation (same as blobs)
- Deletes both Asset (Dexie) and Blob (server + disk)
- Warning if server deletion fails (asset still removed)
- Updates all queries for consistency

### 3. UI Updates

#### Display Name Without Extension

All unlinked assets now show filename without extension:

- Display: "document" instead of "document.pdf"
- File type badge still shows "PDF"
- Rename input pre-filled with name only

#### Context Menu Structure

```
Right-click on Unlinked Asset
├── Rename (opens inline editor)
├── Move to inbox (converts to orphaned blob)
└── Remove (two-click confirmation)
    └── Click again to remove (after first click)
```

#### Visual Feedback

- Context menu positioned at cursor
- Backdrop overlay for dismissal
- Inline editing with border highlight
- Two-click delete shows red warning state

## Data Flow Diagrams

### Move to Inbox Flow

```
Unlinked Asset
    ↓
Delete from Dexie (db.assets.delete)
    ↓
Blob still exists on server
    ↓
Invalidate orphanedBlobs query
    ↓
useOrphanedBlobs re-fetches
    ↓
Blob appears in "New Files (Inbox)"
    ↓
User can re-link or delete
```

### Delete Asset Flow

```
Unlinked Asset
    ↓
Delete from Dexie (db.assets.delete)
    ↓
Delete blob from server + disk
    ↓
Invalidate all file queries
    ↓
Asset removed from sidebar
Blob removed from database
File removed from filesystem
```

### Rename Asset Flow

```
User enters new name (without extension)
    ↓
Strip extension if user added it
    ↓
Add original extension back
    ↓
Update asset.filename in Dexie
    ↓
Update asset.updatedAt timestamp
    ↓
Live query refreshes UI
    ↓
Display shows new name (without extension)
```

## State Management

### Context Menu States

```typescript
// Blob context menu
const [contextMenu, setContextMenu] = useState<{
  x: number;
  y: number;
  blob: BlobWithMetadata;
} | null>(null);

// Asset context menu (new)
const [assetContextMenu, setAssetContextMenu] = useState<{
  x: number;
  y: number;
  asset: Asset;
} | null>(null);

// Rename states
const [renamingBlob, setRenamingBlob] = useState<string | null>(null); // blob hash
const [renamingAsset, setRenamingAsset] = useState<string | null>(null); // asset id
const [renameValue, setRenameValue] = useState(""); // shared input value

// Delete confirmation
const [pendingDelete, setPendingDelete] = useState<string | null>(null); // hash or asset id
```

### Cleanup Handler

```typescript
const handleClickOutside = () => {
  setContextMenu(null); // Close blob menu
  setAssetContextMenu(null); // Close asset menu
  setPendingDelete(null); // Reset delete confirmation
};
```

## Differences: Blob vs Asset Operations

### Rename

| Blob Rename                      | Asset Rename            |
| -------------------------------- | ----------------------- |
| Server API call                  | Dexie update            |
| Updates database + filesystem    | Updates IndexedDB only  |
| Changes actual file name on disk | Only changes metadata   |
| Requires network request         | Instant local operation |

### Delete

| Blob Delete                    | Asset Delete                           |
| ------------------------------ | -------------------------------------- |
| Deletes database record + file | Deletes asset + tries to delete blob   |
| Single source operation        | Two-step operation                     |
| File permanently removed       | Asset removed, blob deletion attempted |

### Move to Inbox

| Feature                 | Behavior                              |
| ----------------------- | ------------------------------------- |
| Only for Assets         | Converts asset back to orphaned blob  |
| No equivalent for blobs | Blobs already in inbox by default     |
| Non-destructive         | File preserved, just metadata removed |
| Reversible              | Can re-create asset from blob         |

## User Experience

### Before:

- ❌ Drop zone stayed visible when leaving window
- ❌ No way to rename unlinked assets
- ❌ No way to move assets back to inbox
- ❌ Couldn't delete assets individually

### After:

- ✅ Drop zone clears when cursor leaves window
- ✅ Right-click menu on unlinked assets
- ✅ Rename with extension handling
- ✅ Move to inbox (convert back to blob)
- ✅ Delete with two-click confirmation
- ✅ All operations update UI instantly

## Testing Checklist

Drop Zone:

- [x] Dragging over library area shows overlay
- [x] Leaving via top edge clears overlay
- [x] Leaving via bottom edge clears overlay
- [x] Leaving via left/right edge clears overlay
- [x] Dragging over child elements maintains overlay
- [x] Dropping file clears overlay
- [x] ESC key (drag cancel) clears overlay

Unlinked Assets:

- [x] Right-click shows context menu
- [x] Click outside closes menu
- [x] Rename opens inline editor
- [x] Extension stripped from input
- [x] Extension added back on save
- [x] Move to inbox moves to "New Files"
- [x] Delete requires two clicks
- [x] Delete removes asset and blob
- [x] All operations update UI

## Files Modified

1. **`/app/library/page.tsx`**
   - Fixed `handleLibraryDragLeave` with null check
   - Added immediate cleanup when leaving window

2. **`/app/library/LibraryLeftSidebar.tsx`**
   - Added `assetContextMenu` state
   - Added `renamingAsset` state
   - Added `handleAssetRename` handler
   - Added `handleAssetDelete` handler
   - Added `handleMoveToInbox` handler
   - Updated unlinked assets list with context menu
   - Added inline rename support for assets
   - Added separate context menu component for assets
   - Updated `handleClickOutside` for both menus

## Edge Cases Handled

1. **Null relatedTarget**: Immediate cleanup when leaving window
2. **Child element navigation**: No false triggers
3. **Extension handling**: Same logic as blobs (strip if added, always append)
4. **Delete confirmation**: Shared state for both menus
5. **Server delete failure**: Asset still removed from Dexie with warning
6. **Rename to same name**: No-op, closes editor
7. **Empty rename**: No-op, closes editor
8. **Move to inbox**: Asset deleted, blob becomes orphaned automatically

## Known Behaviors

1. **Asset rename is local-only**: Doesn't update the blob filename on server
2. **Move to inbox is one-way**: Can re-create asset, but loses any work linkage
3. **Delete asset deletes blob**: Permanent operation, cannot undo
4. **Context menus are exclusive**: Only one menu can be open at a time

## Future Enhancements

Potential improvements:

1. Undo functionality for deletions
2. Batch operations (select multiple assets)
3. Sync asset renames to server blob filename
4. Move to inbox with work preservation option
5. Drag between inbox and unlinked sections
6. Keyboard shortcuts (Del key to delete, F2 to rename)
7. Confirmation dialogs instead of two-click pattern
8. Export/download assets with original filenames
