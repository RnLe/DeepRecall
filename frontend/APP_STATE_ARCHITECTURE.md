# App State Store Architecture Documentation

## Overview

This document describes the new global state management system implemented for DeepRecall using Zustand. The system replaces URL-based navigation with a clean, state-driven approach for tab management and navigation.

## Architecture Components

### 1. AppStateStore (`/app/stores/appStateStore.ts`)

The central store that manages:
- **Tab Management**: Opening, closing, switching between tabs
- **Navigation Queue**: Processing URL-based requests and converting them to tab operations
- **UI State**: Global sidebar state and other app-wide settings
- **Recent Actions**: Tracking user activity for quick access

### 2. Key Types

#### TabWindow
```typescript
interface TabWindow {
  id: string;                     // Unique tab identifier
  literatureId: string;           // Literature document ID
  fileHash?: string;              // Specific version file hash
  title: string;                  // Display title
  literature: LiteratureExtended; // Full literature data
  isActive: boolean;              // Active state
  isPinned: boolean;              // Pinned state (won't auto-close)
  currentPage?: number;           // Current PDF page
  selectedAnnotationId?: string;  // Selected annotation
  lastAccessedAt: Date;           // Last access timestamp
  openedAt: Date;                 // Tab creation timestamp
}
```

#### NavigationRequest
```typescript
interface NavigationRequest {
  id: string;
  type: 'literature' | 'literature-with-hash';
  literatureId?: string;
  fileHash?: string;
  page?: number;
  annotationId?: string;
  createdAt: Date;
}
```

## Flow Diagram

```
URL Request → Navigation Queue → Tab Opening → Canvas State
     ↓               ↓               ↓             ↓
  page.tsx     appStateStore    EditorView   canvasPdfViewerStore
```

## Implementation Details

### 1. URL Consumption (`/deeprecall/pdfviewer/page.tsx`)

- Reads URL parameters (`literature` and `file`)
- Queues navigation requests in the store
- Clears URL parameters after consumption
- Renders EditorView without initial props

### 2. Navigation Processing (`EditorView.tsx`)

- Monitors navigation queue and literature data availability
- Processes queued requests when data becomes ready
- Opens tabs and sets active states through the store
- Maintains backward compatibility with existing components

### 3. Tab Management

- **Smart Tab Limits**: Enforces maximum tab count while preserving pinned tabs
- **LRU Eviction**: Closes least recently used tabs when limit is exceeded
- **State Persistence**: Maintains tab state (page, annotations, scroll position)

### 4. Store Separation

- **AppStateStore**: High-level orchestration and navigation
- **CanvasPdfViewerStore**: PDF-specific canvas state and operations
- Clear separation of concerns between app flow and domain-specific state

## Usage Examples

### Opening a Tab Programmatically
```typescript
const { openTab } = useAppStateStore();
openTab(literature, fileHash); // Opens or switches to existing tab
```

### Navigation via URL
```typescript
// URL: /deeprecall/pdfviewer?literature=123&file=abc
// Automatically processed and URL cleaned after consumption
```

### Accessing Active Tab
```typescript
const { getActiveTab } = useAppStateStore();
const activeTab = getActiveTab(); // Returns current TabWindow or undefined
```

## Benefits

1. **Clean URL Handling**: URLs are consumed and cleaned, preventing persistence issues
2. **Unified State**: Single source of truth for application state
3. **Scalability**: Easy to extend with new navigation types and tab features
4. **Performance**: Efficient tab management with LRU eviction
5. **Developer Experience**: Clear separation of concerns and predictable state flow

## Future Enhancements

1. **Tab Persistence**: Save/restore tabs across browser sessions
2. **Advanced Navigation**: Support for bookmarks, tab groups, and workspaces
3. **Keyboard Shortcuts**: Tab switching and management via keyboard
4. **Tab Previews**: Thumbnail previews for quick tab identification
5. **Annotation Sync**: Cross-tab annotation state synchronization

## Migration Notes

- Existing components remain compatible
- URL-based navigation is now handled internally
- Manual tab management through the store is preferred
- Old prop-passing patterns can be gradually refactored to use the store directly
