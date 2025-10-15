# Library UI Components - Quick Reference

## Overview

Modern, minimal library interface with dark neutral colors. Displays Works (not raw blobs) with comprehensive filtering and search.

## Components

### 1. Library Page (`app/library/page.tsx`)

Main page component orchestrating the library view.

**Features:**

- Work-based display (not blob-centric)
- Live search and filtering
- Sort by title/date/author
- Favorites toggle
- Orphaned blobs section
- Empty states for no results

**State Management:**

```typescript
const [searchQuery, setSearchQuery] = useState("");
const [selectedType, setSelectedType] = useState<WorkType | "all">("all");
const [sortBy, setSortBy] = useState<"title" | "date" | "author">("title");
const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
```

**Data Flow:**

```
useWorksExtended() → filter/sort → WorkCard grid
```

### 2. WorkCard (`app/library/WorkCard.tsx`)

Individual work card in the grid.

**Props:**

```typescript
interface WorkCardProps {
  work: WorkExtended;
  onClick?: () => void;
}
```

**Visual Elements:**

- Work type icon (BookOpen)
- Favorite indicator (Star, amber-500)
- Title + subtitle
- Authors (truncated with "et al.")
- Year display
- Work type badge
- Topics (first 3 + count)
- Version/asset counts

**Color Scheme:**

- Background: `neutral-900/50` → `neutral-900/80` (hover)
- Border: `neutral-800/50` → `neutral-700` (hover)
- Text: `neutral-100` (title), `neutral-400` (meta)
- Badges: `neutral-800/50` background

### 3. LibraryHeader (`app/library/LibraryHeader.tsx`)

Top section with title, stats, and actions.

**Props:**

```typescript
interface LibraryHeaderProps {
  workCount: number;
  onCreateWork?: () => void;
}
```

**Actions:**

- Scan button: `bg-neutral-800` → `neutral-700` (hover)
- New Work button: `bg-neutral-100` → `white` (hover)

**Stats Bar:**

- Work count (BookOpen icon)
- Total blobs (FileText icon)
- Orphaned blobs (amber-500 accent)

### 4. LibraryFilters (`app/library/LibraryFilters.tsx`)

Search and filter controls.

**Props:**

```typescript
interface LibraryFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedType: WorkType | "all";
  onTypeChange: (type: WorkType | "all") => void;
  sortBy: "title" | "date" | "author";
  onSortChange: (sort: "title" | "date" | "author") => void;
  showFavoritesOnly: boolean;
  onToggleFavorites: () => void;
}
```

**Features:**

- Search input with icon (neutral colors)
- Collapsible filter panel
- Work type dropdown (all, paper, textbook, etc.)
- Sort dropdown (title/date/author)
- Favorites checkbox (amber accent)

### 5. OrphanedBlobs (`app/library/OrphanedBlobs.tsx`)

Section showing unlinked files.

**Auto-visibility:** Only renders if orphans exist

**Visual Style:**

- Amber accent color (`amber-500`, `amber-900/30`)
- FileQuestion icon
- Compact grid (max 6 shown)
- Link button per blob
- "Show all" if >6 orphans

## Color Palette

### Neutral Scale

```css
neutral-100: #f5f5f5  /* Primary text, buttons */
neutral-200: #e5e5e5  /* Secondary text */
neutral-300: #d4d4d4  /* Tertiary text */
neutral-400: #a3a3a3  /* Meta text */
neutral-500: #737373  /* Subdued text */
neutral-600: #525252  /* Muted text */
neutral-700: #404040  /* Borders (hover) */
neutral-800: #262626  /* Borders, backgrounds */
neutral-900: #171717  /* Card backgrounds */
```

### Accent Colors

```css
amber-500: #f59e0b  /* Favorites, warnings */
amber-800: #92400e  /* Hover states */
amber-900: #78350f  /* Backgrounds */
```

### Removed

- ❌ All blue colors (`blue-600`, `blue-400`, etc.)

## Layout Grid

```
Grid: 1 col (mobile) → 2 (md) → 3 (lg) → 4 (xl)
Gap: 4 (1rem)
Max width: 7xl (80rem)
Padding: 8 (2rem)
```

## Search Algorithm

```typescript
// Searches across multiple fields
work.title.toLowerCase().includes(query) ||
  work.subtitle?.toLowerCase().includes(query) ||
  work.authors.some((a) => a.name.toLowerCase().includes(query)) ||
  work.topics.some((t) => t.toLowerCase().includes(query));
```

## Sort Functions

### By Title

```typescript
sorted.sort(compareWorksByTitle); // A-Z
```

### By Author

```typescript
sorted.sort((a, b) => {
  const aAuthor = a.authors.length > 0 ? a.authors[0].name : "Unknown";
  const bAuthor = b.authors.length > 0 ? b.authors[0].name : "Unknown";
  return aAuthor.localeCompare(bAuthor);
});
```

### By Date

```typescript
// Most recent version year first
const aMax = Math.max(...a.versions.map((v) => v.year).filter(Boolean));
const bMax = Math.max(...b.versions.map((v) => v.year).filter(Boolean));
return bMax - aMax; // Descending
```

## Empty States

### No Works at All

```
BookOpen icon (neutral-700)
"No works in library yet"
"Scan your files or create a new work to get started"
```

### No Results After Filter

```
BookOpen icon (neutral-700)
"No works match your filters"
"Try adjusting your search or filters"
```

## Interactions

### Hover States

- Work cards: border color shift + background opacity
- Buttons: background color transition
- Duration: 200ms

### Click Handlers

- **WorkCard**: Navigate to work detail (TODO)
- **Scan button**: Triggers file system scan
- **New Work button**: Opens create modal (TODO)
- **Link button**: Opens link-to-work dialog (TODO)

## Dependencies

```typescript
// Hooks
import { useWorksExtended } from "@/src/hooks/useLibrary";
import { useOrphanedBlobs, useBlobStats } from "@/src/hooks/useBlobs";
import { useScanMutation } from "@/src/hooks/useFilesQuery";

// Utils
import {
  getPrimaryAuthors,
  getDisplayYear,
  compareWorksByTitle,
  compareWorksByDate,
} from "@/src/utils/library";

// Types
import type { WorkType, WorkExtended } from "@/src/schema/library";

// Icons (Lucide)
import {
  BookOpen,
  FileText,
  Star,
  Users,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  FileQuestion,
  Link,
} from "lucide-react";
```

## TODO Items

1. Implement work detail page navigation
2. Create "New Work" modal/dialog
3. Implement "Link blob to work" dialog
4. Add keyboard shortcuts (⌘K for search, etc.)
5. Add bulk selection/operations
6. Implement "Show all orphaned files" view
7. Add work export/import
8. Add collection quick-filters

## File Structure

```
app/library/
├── page.tsx              # Main page (orchestrator)
├── WorkCard.tsx          # Work card component
├── LibraryHeader.tsx     # Header with stats/actions
├── LibraryFilters.tsx    # Search and filter controls
└── OrphanedBlobs.tsx     # Unlinked files section
```

## Testing Notes

- Test with 0 works (empty state)
- Test with many works (grid scaling)
- Test search with partial matches
- Test all filter combinations
- Test sort functions
- Test with orphaned blobs
- Test with no orphaned blobs (component hidden)
- Test hover states and transitions
- Test responsive breakpoints

## Accessibility

- Semantic HTML structure
- Keyboard navigable (buttons, inputs, selects)
- Focus states on interactive elements
- Alt text for icons (via title attributes)
- Color contrast meets WCAG AA
- Screen reader friendly labels

## Performance

- `useMemo` for filtered/sorted results
- Live queries automatically dedupe
- Grid uses CSS Grid (hardware accelerated)
- Orphaned blobs limited to 6 preview items
- No infinite scroll (simple pagination)
