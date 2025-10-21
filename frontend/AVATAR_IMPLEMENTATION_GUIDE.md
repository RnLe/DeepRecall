# Avatar System Implementation Guide

## ✅ Completed Components

### 1. ImageCropper Component

**Location:** `/frontend/src/components/ImageCropper.tsx`

**Features:**

- Upload validation (max 10MB, 4000x4000px)
- Auto-compression to ~2MB for "original" version
- Interactive square crop selection with drag & zoom
- Real-time preview
- Outputs two images:
  - Original (compressed, up to 2MB)
  - Display (100x100px thumbnail)
- Saves crop region metadata for re-editing

**Usage:**

```tsx
<ImageCropper
  initialImageUrl={author.avatarOriginalPath}
  initialCropRegion={author.avatarCropRegion}
  onSave={async (data) => {
    // data contains: originalBlob, displayBlob, cropRegion
  }}
  onCancel={() => {}}
/>
```

### 2. Avatar API Endpoints

**Location:** `/frontend/app/api/avatars/`

**Endpoints:**

- `POST /api/avatars` - Upload avatar (multipart form data)
  - Fields: `authorId`, `original` (file), `display` (file), `cropRegion` (JSON)
  - Returns: `{ paths: { original, display }, cropRegion }`
- `DELETE /api/avatars?path=...` - Delete avatar file
- `GET /api/avatars/[filename]` - Serve avatar image
  - Cached with `max-age=31536000`

**Storage:** `/data/avatars/` with filenames: `{authorId}_{original|display}_{timestamp}.jpg`

### 3. Avatar Hooks

**Location:** `/frontend/src/hooks/useAvatars.ts`

**Hooks:**

```tsx
const uploadMutation = useUploadAvatar();
const deleteMutation = useDeleteAvatar();

// Upload
await uploadMutation.mutateAsync({
  authorId: "...",
  originalBlob: blob1,
  displayBlob: blob2,
  cropRegion: { x: 0.25, y: 0.25, size: 0.5 },
});

// Delete
await deleteMutation.mutateAsync("/api/avatars/author_original_123.jpg");
```

### 4. Schema Updates

**Location:** `/frontend/src/schema/library.ts`

**New Types:**

```typescript
export const CropRegionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  size: z.number().min(0).max(1),
});

export type CropRegion = z.infer<typeof CropRegionSchema>;
```

**Author Schema Updates:**

```typescript
export const AuthorSchema = z.object({
  // ... existing fields ...

  // Avatar
  avatarOriginalPath: z.string().optional(), // Path to original (compressed) image
  avatarDisplayPath: z.string().optional(), // Path to display (100x100px) image
  avatarCropRegion: CropRegionSchema.optional(), // Crop region for re-editing

  // ... timestamps ...
});
```

### 5. Dexie Schema Update

**Location:** `/frontend/src/db/dexie.ts`

**Version 6 added:**

- Indexed `avatarDisplayPath` field in authors table
- Optional fields: `avatarOriginalPath`, `avatarCropRegion` (not indexed)
- No data migration needed (fields are optional)

---

## 🔨 Next Step: AuthorLibrary Component Redesign

The AuthorLibrary component needs to be visually overhauled with the following features:

### Design Requirements

#### 1. Card-Based Layout (Two Modes)

**Full Card Mode (Default):**

- Grid layout: 3-4 cards per row (responsive)
- Each card shows:
  - Avatar (circle, 64x64px) top-left with camera icon overlay on hover
  - Author name (first + middle + last)
  - Title (Dr., Prof., etc.) in smaller, italic serif font
  - Affiliation with building icon
  - Work statistics by type: "2 papers, 1 textbook" (NO "X work" generic text)
  - Contact/website icons (small, bottom)
  - Hover: border changes to blue, camera icon appears

**List Mode (Compact):**

- Single column, minimal height per row
- Avatar (circle, 32x32px) on left
- Name + title inline
- Affiliation truncated
- Work count (total only, e.g., "3 works")
- No contact icons

#### 2. Display Mode Toggle

- Icons: LayoutGrid and List
- Toggle buttons in top-right of toolbar
- Persisted in component state (not localStorage for MVP)

#### 3. Work Statistics by Type

**Current:** "X work(s)"  
**New:** "2 papers, 1 textbook, 3 notes"

Calculate from work types:

```typescript
const authorWorkStats = useMemo(() => {
  const stats = new Map<string, Record<string, number>>();
  works.forEach((work) => {
    work.authorIds?.forEach((authorId: string) => {
      if (!stats.has(authorId)) stats.set(authorId, {});
      const authorStats = stats.get(authorId)!;
      const type = work.workType || "unknown";
      authorStats[type] = (authorStats[type] || 0) + 1;
    });
  });
  return stats;
}, [works]);
```

Then display:

```typescript
const workSummary = Object.entries(workStats)
  .map(([type, count]) => `${count} ${type}${count !== 1 ? "s" : ""}`)
  .join(", ");
```

#### 4. Avatar Component

Create reusable `Avatar` component:

```tsx
interface AvatarProps {
  author: Author;
  size?: "small" | "medium" | "large"; // 32px, 48px, 64px
  className?: string;
}

function Avatar({ author, size = "medium", className = "" }: AvatarProps) {
  const sizeClasses = {
    small: "w-8 h-8 text-xs",
    medium: "w-12 h-12 text-sm",
    large: "w-16 h-16 text-base",
  };

  const initials = `${author.firstName[0]}${author.lastName[0]}`.toUpperCase();

  if (author.avatarDisplayPath) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-neutral-800 border-2 border-neutral-700 overflow-hidden flex-shrink-0 ${className}`}
      >
        <img
          src={author.avatarDisplayPath}
          alt={getAuthorFullName(author)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Fallback: gradient with initials
  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-medium text-white flex-shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
}
```

#### 5. Avatar Edit Flow

Add "Edit Avatar" button in AuthorEditView:

```tsx
<div className="flex items-center gap-4 p-4 bg-neutral-800 rounded-lg">
  <Avatar author={author} size="large" />
  <div className="flex-1">
    <h3 className="text-sm font-medium text-neutral-200 mb-1">
      Profile Picture
    </h3>
    <p className="text-xs text-neutral-400 mb-2">
      Upload an avatar image for this author
    </p>
    <button
      onClick={onEditAvatar}
      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
    >
      <Camera className="w-4 h-4" />
      {author.avatarDisplayPath ? "Change Avatar" : "Upload Avatar"}
    </button>
  </div>
</div>
```

#### 6. Camera Icon Overlay (Card Mode)

```tsx
<div className="relative w-fit mb-3">
  <Avatar author={author} size="large" />
  <button
    onClick={(e) => {
      e.stopPropagation();
      onEditAvatar();
    }}
    className="absolute -bottom-1 -right-1 p-1.5 bg-blue-600 hover:bg-blue-700 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
  >
    <Camera className="w-3 h-3" />
  </button>
</div>
```

### Implementation Steps

1. **Add Avatar Component** (reusable, place at top of file after imports)

2. **Update AuthorListView**
   - Add `displayMode` state
   - Add toggle buttons in toolbar
   - Replace list rendering with conditional: `displayMode === "cards" ? <CardsGrid /> : <CompactList />`

3. **Create AuthorCard Component** (replaces current list item for card mode)
   - Avatar with camera overlay
   - Name + title (serif italic)
   - Affiliation with icon
   - Work stats (by type, no "X work" text)
   - Contact icons

4. **Create AuthorListItem Component** (compact mode)
   - Small avatar (32px)
   - Inline name + title
   - Truncated affiliation
   - Total work count only

5. **Add Avatar Edit View**
   - New view state: `"avatar"`
   - Renders `<ImageCropper />` full-screen
   - On save: upload images, delete old, update author
   - On cancel: return to edit view

6. **Update AuthorEditView**
   - Add avatar section with current avatar + edit button
   - Wire up `onEditAvatar` callback

### Styling Notes

- **Cards:** `bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 hover:border-blue-600`
- **Grid:** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3`
- **Title font:** `font-serif italic text-xs text-neutral-400`
- **Avatar gradients:** `from-blue-600 to-purple-600` (or other color pairs for variety)
- **Camera icon:** `opacity-0 group-hover:opacity-100 transition-opacity`

### Testing Checklist

- [ ] Upload avatar → should compress and save
- [ ] Edit avatar → should load original with crop region
- [ ] Delete author with avatar → should clean up image files
- [ ] Avatar displays in cards and list modes
- [ ] Initials fallback for authors without avatars
- [ ] Work stats show correct types (papers, textbooks, etc.)
- [ ] Display mode toggle works
- [ ] Search works in both display modes
- [ ] Responsive grid layout

---

## Files to Modify

1. **`/frontend/app/library/AuthorLibrary.tsx`**
   - Add imports for new components
   - Add `displayMode` state
   - Add `Avatar` component
   - Redesign `AuthorListView` with toggle
   - Create `AuthorCard` and `AuthorListItem` components
   - Add `AvatarEditView`
   - Update `AuthorEditView` with avatar section

2. **Create avatars directory:**
   ```bash
   mkdir -p /home/renlephy/DeepRecall/data/avatars
   ```

---

## Quick Start Code Snippets

### Main Component State Addition

```typescript
const [displayMode, setDisplayMode] = useState<DisplayMode>("cards");

// In view switching:
{view === "avatar" && selectedAuthor && (
  <AvatarEditView
    author={selectedAuthor}
    onBack={() => setView("edit")}
    onUpdate={updateMutation.mutateAsync}
  />
)}
```

### AvatarEditView Component

```typescript
function AvatarEditView({ author, onBack, onUpdate }: AvatarEditViewProps) {
  const uploadMutation = useUploadAvatar();
  const deleteMutation = useDeleteAvatar();

  const handleSave = async (data: {
    originalBlob: Blob;
    displayBlob: Blob;
    cropRegion: CropRegion;
  }) => {
    try {
      const result = await uploadMutation.mutateAsync({
        authorId: author.id,
        ...data,
      });

      // Delete old avatar
      if (author.avatarOriginalPath) {
        await deleteMutation.mutateAsync(author.avatarOriginalPath);
      }
      if (author.avatarDisplayPath) {
        await deleteMutation.mutateAsync(author.avatarDisplayPath);
      }

      // Update author
      await onUpdate({
        id: author.id,
        updates: {
          avatarOriginalPath: result.paths.original,
          avatarDisplayPath: result.paths.display,
          avatarCropRegion: result.cropRegion,
        },
      });

      alert("Avatar updated successfully!");
      onBack();
    } catch (error) {
      console.error("Failed to update avatar:", error);
      alert("Failed to update avatar. Please try again.");
    }
  };

  return (
    <ImageCropper
      initialImageUrl={author.avatarOriginalPath}
      initialCropRegion={author.avatarCropRegion}
      onSave={handleSave}
      onCancel={onBack}
    />
  );
}
```

---

## Known Imports Needed

```typescript
import { Camera, LayoutGrid, List as ListIcon } from "lucide-react";
import { ImageCropper } from "@/src/components/ImageCropper";
import { useUploadAvatar, useDeleteAvatar } from "@/src/hooks/useAvatars";
import type { CropRegion } from "@/src/schema/library";
```

---

## Troubleshooting

### "Cannot find module '@/src/utils/bibtexParser'"

- The parser is in `/frontend/src/utils/nameParser.ts`
- Import: `import { parseAuthorList } from "@/src/utils/nameParser";`

### Images not loading

- Check that `/data/avatars/` directory exists
- Verify API routes are working: test `POST /api/avatars` with Postman
- Check browser console for 404 errors on image URLs

### Database version not upgrading

- Clear IndexedDB in browser DevTools → Application → IndexedDB → Delete
- Refresh page to trigger migration to version 6

---

This completes the foundational avatar system. The AuthorLibrary redesign is now ready for implementation following the patterns and components provided above.
