# Tab-Based Reader Interface - Implementation Guide

**Date**: October 16, 2025  
**Status**: ✅ Complete - VSCode-style interface with tabs, sidebars, and file browser

---

## Overview

A production-ready, VSCode-style PDF reader interface with:

- **Tab management**: Multiple PDFs open simultaneously
- **File browser**: Left sidebar with Assets from Dexie
- **Resizable panels**: Drag to resize sidebars
- **Space-efficient**: Maximizes PDF canvas area
- **Extensible**: Ready for different view types (annotation editor, card generator)

---

## Architecture

### Component Hierarchy

```
ReaderPage
└── ReaderLayout (main container)
    ├── TopBar (sidebar toggles)
    ├── LeftSidebar (resizable)
    │   └── FileList (Assets from Dexie)
    ├── CenterContent
    │   ├── TabBar (open tabs)
    │   └── TabContent (active tab view)
    │       └── PDFViewer | AnnotationEditor | CardGenerator
    └── RightSidebar (resizable, tools panel)
```

### State Management (Zustand)

**Store**: `/src/stores/reader-ui.ts`

```ts
interface ReaderUIState {
  // Tab management
  tabs: Tab[];
  activeTabId: string | null;

  // Sidebar state
  leftSidebarOpen: boolean;
  leftSidebarWidth: number;
  rightSidebarOpen: boolean;
  rightSidebarWidth: number;

  // Actions
  openTab(assetId, title, type);
  closeTab(tabId);
  setActiveTab(tabId);
  toggleLeftSidebar();
  toggleRightSidebar();
  // ... more
}
```

**Tab Interface**:

```ts
interface Tab {
  id: string; // Unique ID
  type: TabType; // "pdf-viewer" | "annotation-editor" | "card-generator"
  assetId: string; // SHA-256 hash
  title: string; // Display name
  isDirty?: boolean; // Unsaved changes
}
```

---

## Components

### 1. ReaderLayout

**Purpose**: Main container with resizable sidebars  
**File**: `ReaderLayout.tsx`

**Features**:

- Top bar with sidebar toggle buttons
- Resizable left sidebar (file list)
- Resizable right sidebar (tools)
- Mouse drag to resize
- Persists sidebar state to localStorage

**Props**:

```ts
interface ReaderLayoutProps {
  children: React.ReactNode; // TabContent
}
```

---

### 2. FileList

**Purpose**: Left sidebar showing PDF files from Dexie  
**File**: `FileList.tsx`

**Features**:

- Loads Assets from Dexie (live query)
- Separates linked and unlinked assets
- Shows which files are open (blue dot)
- Highlights active file
- Click to open in new tab

**Data Source**:

```ts
const assets = useLiveQuery(() => db.assets.toArray());
const pdfAssets = assets.filter((a) => a.mime.startsWith("application/pdf"));
const linkedAssets = pdfAssets.filter((a) => a.workId);
const unlinkedAssets = pdfAssets.filter((a) => !a.workId);
```

---

### 3. TabBar

**Purpose**: VSCode-style tab bar for open files  
**File**: `TabBar.tsx`

**Features**:

- Displays all open tabs
- Highlights active tab
- Close button (X) on each tab
- Dirty indicator (dot) for unsaved changes
- Hover effects

**Behavior**:

- Click tab → switch to that tab
- Click X → close tab (switches to adjacent tab)
- If closing last tab → empty state

---

### 4. TabContent

**Purpose**: Renders content based on active tab type  
**File**: `TabContent.tsx`

**Features**:

- Gets active tab from Zustand
- Generates blob URL: `/api/blob/${sha256}`
- Routes to appropriate view based on tab type
- Shows empty state if no tab open

**View Types**:

```ts
type TabType =
  | "pdf-viewer" // Full PDF viewer (current)
  | "annotation-editor" // Annotation tools (future)
  | "card-generator"; // SRS card creation (future)
```

---

## User Flows

### Opening a File

1. User clicks file in FileList
2. `useReaderUI.openTab(sha256, filename, "pdf-viewer")`
3. Store checks if tab exists → if yes, activate; if no, create new
4. New tab added to tabs array
5. Tab becomes active
6. TabBar updates (new tab appears)
7. TabContent renders PDFViewer with `/api/blob/${sha256}`

### Switching Tabs

1. User clicks tab in TabBar
2. `useReaderUI.setActiveTab(tabId)`
3. TabContent re-renders with new active tab
4. PDFViewer mounts with new source

### Closing a Tab

1. User clicks X on tab
2. `useReaderUI.closeTab(tabId)`
3. Tab removed from array
4. If closing active tab → switch to adjacent tab
5. TabBar updates
6. TabContent re-renders

### Resizing Sidebars

1. User drags resize handle
2. MouseMove event updates sidebar width
3. Zustand store updates width
4. Component re-renders with new width
5. Width persisted to localStorage

---

## Integration with Existing System

### PDF Rendering (Unchanged)

The existing PDF rendering system works without modification:

- `PDFViewer` component still renders PDFs
- `usePDF`, `usePDFPage`, `usePDFViewport` hooks unchanged
- Virtual scrolling and caching still active

### Annotation Overlay (Ready)

Annotations are loaded per-asset:

```ts
// In TabContent.tsx (TODO)
const annotations = useLiveQuery(() =>
  db.annotations.where("sha256").equals(assetId).toArray()
);

// Convert to Map<pageNumber, Annotation[]>
const annotationsMap = groupByPage(annotations);

// Pass to PDFViewer
<PDFViewer annotations={annotationsMap} />
```

### Blob Loading

Files are loaded via SHA-256:

```ts
const blobUrl = `/api/blob/${assetId}`;
<PDFViewer source={blobUrl} />
```

---

## Layout Specifications

### Default Sizes

```
Left Sidebar:  280px (min: 200px, max: 600px)
Right Sidebar: 320px (min: 200px, max: 600px)
Tab Height:    ~36px
Top Bar:       ~32px
```

### Space Efficiency

```
┌────────────────────────────────────────────────────────────┐
│ Top Bar (32px) [Toggle Left] ............. [Toggle Right] │
├──────────┬───────────────────────────────────┬─────────────┤
│          │ TabBar (36px)                     │             │
│  File    ├───────────────────────────────────┤   Tools     │
│  List    │                                   │   Panel     │
│  (280px) │     PDF Canvas (maximized)        │   (320px)   │
│          │                                   │             │
│          │                                   │   (hidden   │
│          │                                   │    by       │
│          │                                   │   default)  │
└──────────┴───────────────────────────────────┴─────────────┘
```

**Calculation**:

```
Canvas Width = Window Width - Left Sidebar - Right Sidebar - Borders
             = 1920px - 280px - 0px - 4px
             = 1636px (plenty of space!)
```

---

## Future Enhancements

### Phase 1: Annotation Tools (Next)

- Add annotation toolbar to right sidebar
- Tool selection (highlight, rect, note)
- Color picker
- Annotation list

### Phase 2: Tab Types

- Implement annotation editor view
- Implement card generator view
- Add tab type selector

### Phase 3: Advanced Features

- Tab reordering (drag to reorder)
- Split view (two tabs side by side)
- Tab groups (organize related files)
- Recently closed tabs
- Pin tabs

### Phase 4: Keyboard Shortcuts

- `Cmd/Ctrl + W`: Close tab
- `Cmd/Ctrl + Tab`: Next tab
- `Cmd/Ctrl + Shift + Tab`: Previous tab
- `Cmd/Ctrl + T`: New tab (file picker)
- `Cmd/Ctrl + B`: Toggle left sidebar

---

## Code Examples

### Opening a Tab Programmatically

```ts
import { useReaderUI } from "@/src/stores/reader-ui";

function MyComponent() {
  const { openTab } = useReaderUI();

  const handleOpenFile = (sha256: string, filename: string) => {
    openTab(sha256, filename, "pdf-viewer");
  };

  return <button onClick={() => handleOpenFile("abc123", "Paper.pdf")}>Open</button>;
}
```

### Checking if Tab is Open

```ts
const { hasTab } = useReaderUI();

if (hasTab("abc123")) {
  console.log("File is already open");
}
```

### Getting Active Tab

```ts
const { getActiveTab } = useReaderUI();
const activeTab = getActiveTab();

if (activeTab) {
  console.log("Currently viewing:", activeTab.title);
}
```

### Marking Tab as Dirty

```ts
const { updateTab, activeTabId } = useReaderUI();

const handleEdit = () => {
  if (activeTabId) {
    updateTab(activeTabId, { isDirty: true });
  }
};
```

---

## Performance Considerations

### Tab Limit

Currently no limit on open tabs. Consider adding:

```ts
const MAX_TABS = 10;

if (tabs.length >= MAX_TABS) {
  alert("Maximum tabs reached. Close a tab to open a new one.");
  return;
}
```

### PDF Cleanup

PDFs are cleaned up when tabs close (handled by `usePDF` hook's cleanup).

### Sidebar Persistence

Sidebar state (open/closed, width) is persisted to localStorage via Zustand middleware.

Tabs are **not** persisted (fresh start each session).

---

## Styling & Theming

### Color Scheme

```
Background:      #FFFFFF (white)
Sidebar:         #F9FAFB (gray-50)
Border:          #E5E7EB (gray-200)
Active Tab:      #FFFFFF + blue-500 border
Hover:           #F3F4F6 (gray-100)
Accent:          #3B82F6 (blue-500)
```

### Responsive (Future)

Current implementation is desktop-only. For mobile:

- Collapse sidebars by default
- Full-width tabs (scrollable)
- Bottom toolbar instead of right sidebar

---

## Testing Checklist

- [ ] Open multiple PDFs from file list
- [ ] Switch between tabs
- [ ] Close tabs (including active tab)
- [ ] Resize left sidebar
- [ ] Resize right sidebar
- [ ] Toggle sidebars on/off
- [ ] Reload page (sidebar state persists)
- [ ] Open same file twice (should activate existing tab)
- [ ] Close all tabs (empty state shows)

---

## Troubleshooting

### "No PDF files found"

**Cause**: No Assets in Dexie  
**Fix**: Add PDFs to library, or check Dexie schema

### Tabs don't switch

**Cause**: Zustand store not updating  
**Fix**: Check console for errors, ensure store is imported correctly

### Sidebar doesn't resize

**Cause**: Mouse events not captured  
**Fix**: Check that resize div has correct cursor style

### PDF doesn't load

**Cause**: Blob endpoint not returning file  
**Fix**: Check `/api/blob/${sha256}` returns PDF data

---

## Summary

✅ **Complete**: Tab-based interface with file browser  
✅ **Space-efficient**: Maximizes PDF canvas  
✅ **Scalable**: Ready for multiple view types  
✅ **Reusable**: Components are modular  
✅ **Persistent**: Sidebar state saved

**Next**: Add annotation tools to right sidebar!
