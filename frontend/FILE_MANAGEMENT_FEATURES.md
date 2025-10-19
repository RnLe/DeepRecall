# File Management Features

## Overview

Added comprehensive file management features including context menus, renaming, and deletion across the library interface.

## Features Implemented

### 1. Context Menu for File Inbox

**Location:** `FileInbox.tsx` and `LibraryLeftSidebar.tsx`

**Actions Available:**

- **Rename**: Opens inline text editor to rename the file
- **Link to work**: Opens the link dialog to attach file to a work
- **Remove**: Requires double-click confirmation before deletion

**Usage:**

- Right-click on any file in the inbox to open context menu
- Menu is dismissed by clicking outside or after selecting an action

**Implementation Details:**

- Context menu positioned at cursor location
- State management for active menu, rename mode, and pending deletion
- Backdrop overlay to close menu on outside click
- Inline editing with Enter/Escape key support

### 2. Inline Editing in Admin Page

**Location:** `admin/page.tsx`

**Features:**

- Pencil icon appears on hover for each blob entry
- Click pencil to activate edit mode
- Inline text input with:
  - Check button (green) to save
  - X button (red) to cancel
  - Enter key to save
  - Escape key to cancel

**Visual Feedback:**

- Icons only visible on row hover
- Edit mode replaces filename with editable input
- Smooth transitions between states

### 3. File Renaming System

**Backend Endpoints:**

- `PATCH /api/library/blobs/[hash]/rename`
  - Renames file in database AND on filesystem
  - Validates filename (no path separators)
  - Updates both `blobs` and `paths` tables
  - Returns success with new filename and path

**Frontend Integration:**

- Mutation hook with automatic query invalidation
- Error handling with user-friendly alerts
- Optimistic UI updates

**Safety Features:**

- Path separator validation
- File existence checks
- Atomic operations (DB + filesystem)
- Rollback on failure

### 4. File Deletion System

**Backend Endpoint:**

- `DELETE /api/library/blobs/[hash]/delete`
  - Removes blob from database
  - Optionally deletes file from disk
  - Handles foreign key constraints
  - Returns deletion status

**Frontend Integration:**

- Two-click confirmation pattern
- First click: "Click again to remove" warning
- Second click: Executes deletion
- Visual feedback (red highlight on warning state)

**Safety Features:**

- Confirmation required (prevents accidental deletion)
- Visual warning state
- Graceful error handling
- Query invalidation on success

### 5. Original Filename Preservation

**System Behavior:**

- Files uploaded via drag & drop retain original filenames
- Stored in database `filename` column
- Displayed in all UI components
- Used for downloads and exports

**Storage Architecture:**

- Disk: Files named by hash (`{hash}.{ext}`) for deduplication
- Database: Original filename preserved in `blobs.filename`
- UI: Always displays original filename
- Content-addressable storage maintains integrity

## API Endpoints

### Rename Blob

```typescript
PATCH /api/library/blobs/[hash]/rename
Body: { filename: string }
Response: { success: true, filename: string, path: string }
```

### Delete Blob

```typescript
DELETE /api/library/blobs/[hash]/delete
Body: { deleteFile?: boolean }
Response: { success: true, message: string, fileDeleted: boolean }
```

## User Flows

### Renaming a File

1. **From Inbox:**
   - Right-click file → Select "Rename"
   - OR: Click filename while in rename mode
   - Edit name inline
   - Press Enter or click outside to save
   - Press Escape to cancel

2. **From Admin Page:**
   - Hover over blob row
   - Click pencil icon
   - Edit name inline
   - Click check (✓) to save or X to cancel
   - Press Enter to save or Escape to cancel

### Deleting a File

1. Right-click file in inbox
2. Select "Remove"
3. Menu shows "Click again to remove" in red
4. Click "Remove" again to confirm
5. File deleted from database and disk

### Linking a File

1. Right-click file in inbox
2. Select "Link to work"
3. Link dialog opens
4. Select or create work to link file

## Technical Details

### State Management

```typescript
// Context menu state
const [contextMenu, setContextMenu] = useState<{
  x: number;
  y: number;
  blob: BlobWithMetadata;
} | null>(null);

// Rename state
const [renamingBlob, setRenamingBlob] = useState<string | null>(null);
const [renameValue, setRenameValue] = useState("");

// Delete confirmation state
const [pendingDelete, setPendingDelete] = useState<string | null>(null);
```

### Query Invalidation

After rename or delete operations:

```typescript
queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
queryClient.invalidateQueries({ queryKey: ["files"] });
queryClient.invalidateQueries({ queryKey: ["admin", "blobs"] });
```

### Keyboard Shortcuts

- **Enter**: Save rename / Submit
- **Escape**: Cancel rename / Close dialog
- **Right-click**: Open context menu

## Design Patterns

### Two-Click Confirmation

Used for destructive actions to prevent accidents:

1. First click: Show warning with changed styling
2. Second click: Execute action
3. Click outside: Reset to normal state

### Context Menu Pattern

Standard right-click menu with:

- Fixed positioning at cursor
- Backdrop overlay for dismissal
- Clear action hierarchy
- Visual feedback on hover

### Inline Editing Pattern

Seamless editing experience:

- Non-disruptive (no modal dialogs)
- Keyboard-friendly
- Visual indicators for active state
- Clear save/cancel options

## Error Handling

### Rename Errors

- Invalid filename (path separators)
- File not found in database
- Filesystem rename failure
- Conflict with existing file

### Delete Errors

- File not found
- Filesystem access denied
- Foreign key constraint violation

All errors show user-friendly alert messages with specific details.

## Files Modified

### New Files

- `/app/api/library/blobs/[hash]/rename/route.ts`
- `/app/api/library/blobs/[hash]/delete/route.ts`

### Modified Files

- `/app/library/FileInbox.tsx`
  - Added context menu
  - Added rename/delete handlers
  - Added inline editing state

- `/app/library/LibraryLeftSidebar.tsx`
  - Added context menu
  - Added rename/delete handlers
  - Added inline editing state

- `/app/admin/page.tsx`
  - Added pencil icon with hover state
  - Added inline editing with check/cancel buttons
  - Added rename mutation

## Future Enhancements

Potential improvements:

1. Batch operations (rename/delete multiple files)
2. Undo functionality for deletions
3. File preview on hover
4. Drag & drop to reorder
5. Keyboard navigation in context menu
6. Copy/paste file names
7. Duplicate file detection on rename
8. Move files between roles
9. Export/download with original filename
10. Search and filter in admin table

## Notes

- All operations are atomic (DB + filesystem in sync)
- Original filenames always preserved in database
- Content-addressable storage ensures deduplication
- Query invalidation keeps UI in sync
- Error handling prevents data inconsistencies
- Two-click deletion prevents accidents
- Context menus positioned at cursor for convenience
