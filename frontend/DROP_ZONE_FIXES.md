# Drop Zone Fixes and Activity File Upload

## Overview

Fixed two critical issues with drag & drop functionality:

1. Library drop zone visual feedback not clearing when cursor leaves
2. Activities not accepting external file drops from filesystem

## Issues Fixed

### 1. Library Drop Zone Cleanup Issue

**Problem:** The drop zone overlay stayed visible after dragging cursor out of the library area.

**Root Cause:** The `dragLeave` event was firing for child elements, decrementing the counter incorrectly and causing state desync.

**Solution:** Added proper event target checking in `handleLibraryDragLeave`:

```typescript
const handleLibraryDragLeave = (e: React.DragEvent) => {
  e.preventDefault();

  // Only decrement if we're leaving the actual container, not a child element
  const relatedTarget = e.relatedTarget as Node | null;
  const currentTarget = e.currentTarget as Node;

  // If we're moving to a child element within the container, don't decrement
  if (relatedTarget && currentTarget.contains(relatedTarget)) {
    return;
  }

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

**Key Changes:**

- Check if `relatedTarget` (where cursor is moving to) is a child of `currentTarget`
- Only decrement counter when truly leaving the container
- Clamp counter to 0 minimum to prevent negative values

### 2. Activity File Upload Support

**Problem:** Dropping files from filesystem onto activities didn't work - only internal blob/asset dragging was supported.

**Solution:** Added complete file upload pipeline for activities.

#### New Handler: `handleDropFilesToActivity`

```typescript
const handleDropFilesToActivity = async (
  activityId: string,
  files: FileList
) => {
  // 1. Upload files to server (CAS)
  // 2. Create Assets in Dexie
  // 3. Link Assets to Activity via edges
  // 4. Refresh activity to show new files
  // 5. Invalidate orphanedBlobs query
};
```

#### Workflow:

1. **Upload to Server**: Files uploaded via `/api/library/upload` endpoint
   - Files stored with hash-based names on disk
   - Metadata saved to database with original filenames
   - Returns blob metadata

2. **Create Assets**: For each uploaded blob, create Asset in Dexie
   - Asset references blob via `sha256`
   - Stores filename, mime type, size, page count
   - No `workId` (standalone asset)

3. **Link to Activity**: Create edges connecting Activity → Asset
   - Edge type: "contains"
   - `fromId`: Activity ID
   - `toId`: Asset ID

4. **UI Updates**:
   - Refresh activity to display new files
   - Invalidate orphanedBlobs query (files are no longer orphaned)
   - Assets automatically appear in "Unlinked Assets" if not linked to Work

#### Updated ActivityBanner Component

**Props Added:**

```typescript
interface ActivityBannerProps {
  // ... existing props
  onDropFiles: (activityId: string, files: FileList) => void;
}
```

**Drop Handler Updated:**

```typescript
const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragOver(false);

  // Priority 1: Check for external files FIRST
  const files = e.dataTransfer.files;
  if (files && files.length > 0) {
    onDropFiles(activity.id, files);
    return;
  }

  // Priority 2-4: Internal drag data (work/asset/blob)
  // ... existing code
};
```

**DragOver Handler Updated:**

```typescript
const handleDragOver = (e: React.DragEvent) => {
  // Accept both internal drag data and external files
  if (
    e.dataTransfer.types.includes("application/x-work-id") ||
    e.dataTransfer.types.includes("application/x-blob-id") ||
    e.dataTransfer.types.includes("application/x-asset-id") ||
    e.dataTransfer.types.includes("Files") // <-- Added
  ) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }
};
```

**DragLeave Fix:**

```typescript
const handleDragLeave = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  // Only clear isDragOver if truly leaving the banner
  const relatedTarget = e.relatedTarget as Node | null;
  const currentTarget = e.currentTarget as Node;

  if (relatedTarget && currentTarget.contains(relatedTarget)) {
    return;
  }

  setIsDragOver(false);
};
```

## Data Flow for File Drops on Activities

```
External File Drop
    ↓
Activity Drop Handler (Priority Check)
    ↓
handleDropFilesToActivity()
    ↓
┌─────────────────────────────────────────┐
│ 1. Upload to Server (CAS)               │
│    POST /api/library/upload             │
│    → File stored: /data/library/        │
│       main/<hash>.pdf                   │
│    → DB record: blobs table             │
│    ← Returns: blob metadata             │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ 2. Create Asset (Dexie)                 │
│    createAsset({                        │
│      sha256: blob.sha256,               │
│      filename: blob.filename,           │
│      bytes: blob.size,                  │
│      mime: blob.mime,                   │
│      role: "main",                      │
│      // No workId (standalone)          │
│    })                                   │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ 3. Link to Activity (Edge)              │
│    edgeRepo.addToActivity(              │
│      activityId,                        │
│      asset.id                           │
│    )                                    │
│    → Creates Edge:                      │
│      fromId: activityId                 │
│      toId: assetId                      │
│      relation: "contains"               │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ 4. Refresh UI                           │
│    - Reload activity with extended data │
│    - File appears in activity banner    │
│    - Invalidate orphanedBlobs query     │
│    - Asset removed from "New Files"     │
└─────────────────────────────────────────┘
```

## File Lifecycle

### New File Dropped on Activity:

1. **Uploaded**: File → Server CAS → Database
2. **Asset Created**: Blob → Asset (in Dexie)
3. **Linked**: Asset → Activity (via Edge)
4. **Status**: No longer orphaned, appears in activity

### Existing Blob/Asset Dropped on Activity:

1. **Asset Exists**: Use existing Asset ID
2. **Linked**: Asset → Activity (via Edge)
3. **Status**: Removed from "Unlinked Assets", appears in activity

## User Experience

### Before:

- ❌ Dropping files on activities did nothing
- ❌ Drop zone overlay stayed visible after leaving library area
- ❌ Confusing visual feedback

### After:

- ✅ Drop files directly on activities to add them
- ✅ Files uploaded, converted to assets, and linked in one operation
- ✅ Drop zone clears properly when cursor leaves
- ✅ Visual feedback matches actual drop zones
- ✅ Multiple files can be dropped at once
- ✅ Works with drag from file manager or desktop

## Technical Details

### Why No "Orphaned Blob" Step?

The implementation goes directly from **Blob → Asset** because:

1. **Efficiency**: Fewer intermediary states
2. **Consistency**: Same pattern as manual linking
3. **Framework Design**: Assets are the primary abstraction in Dexie
4. **Query Invalidation**: `orphanedBlobs` query updates automatically when Asset is created

### Asset vs Work Linking

- **Work**: Metadata entity (book, paper, etc.)
  - Can have multiple Assets (PDF, slides, data)
  - Assets linked via `workId` field
- **Activity**: Organizational entity (course, project)
  - Can contain Works AND standalone Assets
  - Linked via Edges (`contains` relation)

Dropping files on Activity creates **standalone Assets** (no `workId`), which can:

- Be linked to a Work later
- Remain as activity-specific files
- Be shared across multiple activities

## Files Modified

1. **`/app/library/page.tsx`**
   - Fixed `handleLibraryDragLeave` with proper event checking
   - Added `handleDropFilesToActivity` for file uploads
   - Passed new handler to `ActivityBanner`

2. **`/app/library/ActivityBanner.tsx`**
   - Added `onDropFiles` prop
   - Updated `handleDragOver` to accept Files
   - Fixed `handleDragLeave` with proper event checking
   - Updated `handleDrop` to prioritize external files

## Testing Checklist

- [x] Drop external files on activity → uploads and appears
- [x] Drop multiple files → all uploaded and linked
- [x] Drop blob from sidebar → creates asset and links
- [x] Drop asset from unlinked list → links without duplication
- [x] Drop work on activity → creates edge
- [x] Library drop zone clears when leaving area
- [x] Activity drop zone clears when leaving banner
- [x] No visual glitches or stuck overlays

## Edge Cases Handled

1. **Duplicate Prevention**: Dropping same blob twice uses existing Asset
2. **Priority System**: Files checked before internal drag data
3. **Nested Elements**: Proper `relatedTarget` checking prevents false triggers
4. **Counter Clamping**: Drag counter can't go negative
5. **Error Handling**: Upload failures show user-friendly alerts
6. **Batch Operations**: Multiple files uploaded in parallel with Promise.all

## Future Enhancements

Potential improvements:

1. Progress indicators for multi-file uploads
2. Drag preview thumbnails
3. File type validation before upload
4. Drag & drop reordering within activities
5. Bulk operations (remove multiple files)
6. Undo/redo for file additions
7. Duplicate file detection with merge dialog
