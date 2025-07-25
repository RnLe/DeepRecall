# PDF Viewer Refactor Documentation - Fixed

## Issues Fixed

### 1. Missing `data-index` Warning ✅
- **Problem**: `@tanstack/react-virtual` requires `data-index` attribute on measured elements
- **Solution**: Added `data-index={v.index}` to the element that gets measured (the inner div with `ref`)
- **Location**: `PdfViewerWithAnnotations.tsx` - renderRow function

### 2. Scroll-Triggered Page Jumps ✅  
- **Problem**: Scroll detection was triggering page jumps, creating infinite loops
- **Solution**: Separated scroll detection from programmatic jumping
  - `setCurrentPageFromScroll()` - Updates page display only
  - `jumpToPage()` - Triggers actual scrolling via `isJumping` flag
- **Location**: Store and scroll handler

### 3. Erratic Page Number Updates ✅
- **Problem**: Rapid page changes during scrolling
- **Solutions**: 
  - **Throttled scroll handler** (100ms) to reduce update frequency
  - **Center-based detection** instead of visible area calculation
  - **Conditional updates** only when page actually changes
- **Location**: `PdfViewerWithAnnotations.tsx` - handleScroll function

## Architecture Changes

### Store Separation (`pdfViewerStore.ts`)
```typescript
// Scroll detection (doesn't trigger scroll)
setCurrentPageFromScroll: (page: number) => void

// Programmatic jumping (triggers scroll via isJumping flag)  
jumpToPage: (page: number) => void
```

### Scroll vs Jump Logic
1. **User scrolls** → `handleScroll` → `setCurrentPageFromScroll` → Updates page number display
2. **User clicks page** → `jumpToPage` → Sets `isJumping: true` → Triggers scroll effect → `setIsJumping: false`
3. **During jumping** → `handleScroll` is disabled via `isJumping` check

### Subscription-Based Scrolling (`TabWindowContainer.tsx`)
```typescript
useEffect(() => {
  const unsubscribe = usePdfViewerStore.subscribe(
    (state) => state.isJumping,
    (isJumping, previousIsJumping) => {
      if (isJumping && !previousIsJumping && viewerRef.current) {
        viewerRef.current.scrollToPage(currentPage);
      }
    }
  );
  return unsubscribe;
}, []);
```

## Key Improvements

### Deterministic Control Flow
1. **Scroll Detection**: Throttled, center-based, only updates display
2. **Programmatic Jumps**: Controlled via `isJumping` flag, triggers actual scroll
3. **No Circular Dependencies**: Clear separation between detection and action

### Performance
- Throttled scroll handler (100ms)
- Conditional updates only when page changes
- Efficient center-point detection algorithm

### Robustness  
- `isJumping` flag prevents feedback loops
- Store resets on document change
- Proper cleanup of subscriptions

## Testing Verification

✅ **Console warnings gone**: `data-index` properly applied  
✅ **No scroll-triggered jumps**: Scrolling only updates page number  
✅ **Smooth page jumping**: Navigation controls work correctly  
✅ **Stable page numbers**: No erratic behavior during scroll  
✅ **Annotation clicks**: Still jump to correct pages  
✅ **Fast scrolling**: Handles rapid scrolling without issues

## Changes Made

### 1. Created Zustand Store (`/app/stores/pdfViewerStore.ts`)
- Centralized state management for `currentPage`, `numPages`, `zoom`
- Added `isJumping` flag to prevent circular updates during programmatic scrolling
- Includes `reset()` function to initialize state when switching documents

### 2. Fixed PdfViewerWithAnnotations.tsx
- **Added `data-index` attribute** to virtual items to fix the @tanstack/react-virtual warning
- **Removed React.memo** to prevent stale closure issues with store subscriptions  
- **Improved scroll detection**: Now finds the most visible page by calculating visible area instead of just using the first virtual item
- **Removed zoom and onVisiblePageChange props** - now handled by store
- **Fixed circular dependencies** by using `isJumping` flag from store

### 3. Updated TabWindowContainer.tsx
- **Removed local state** for `page`, `zoom`, `numPages` 
- **Integrated store** for all viewer state management
- **Simplified prop passing** - no more zoom/page props to child component
- **Added document reset** - store resets when switching PDFs
- **Fixed all navigation handlers** to use store actions

## Key Improvements

### Fixed Issues:
1. ✅ **Missing `data-index` warning** - Added proper attribute to virtual items
2. ✅ **Page jumping accuracy** - Better visible page detection algorithm  
3. ✅ **Circular page updates** - Store prevents loops with `isJumping` flag
4. ✅ **Race conditions** - Centralized state eliminates prop/callback races

### Performance:
- Store subscriptions are more efficient than prop drilling
- Removed React.memo which was causing stale closure issues
- Better scroll performance with improved visible page detection

### Architecture:
- Clean separation of concerns
- Single source of truth for viewer state
- Easier to debug and maintain
- Extensible for future features

## Testing Instructions

1. **Load a PDF** - Should load normally, page 1 selected
2. **Scroll through pages** - Page number should update accurately in header
3. **Jump to specific page** (via input or annotation click) - Should scroll smoothly without loops
4. **Fast scrolling** - Should handle rapid scrolling without jumping erratically  
5. **Zoom in/out** - Should preserve current page position
6. **Switch documents** - Should reset to page 1 with proper zoom
7. **Console** - No more "Missing attribute name 'data-index'" warnings

## Implementation Notes

- Store uses `subscribeWithSelector` middleware for fine-grained subscriptions
- `isJumping` flag prevents feedback loops during programmatic scrolling
- Store automatically clamps page numbers to valid range [1, numPages]
- Document reset ensures clean state when switching between PDFs
