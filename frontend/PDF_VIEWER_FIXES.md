# PDF Viewer Infinite Loop and Freezing Fixes

## Problem
The PDF viewer was experiencing infinite loops, browser freezing, and constant RAM increase due to:
1. Infinite re-renders caused by unstable dependencies in `useMemo`
2. PDF service being cleaned up and reloaded continuously
3. Race conditions between component mounting/unmounting

## Key Changes Made

### 1. Fixed useMemo Dependencies
**Problem**: Using mutable objects (`Set`, `Map`) directly in `useMemo` dependencies caused React to treat them as always changing.

**Solution**: Convert to stable arrays/objects before using as dependencies:
```typescript
// Before (caused infinite loops)
useMemo(() => {...}, [visiblePages, pageDimensions, ...])

// After (stable dependencies)
const visiblePagesArr = useMemo(() => Array.from(visiblePages).sort(), [visiblePages]);
const pageDimensionsObj = useMemo(() => {
  const obj = {};
  pageDimensions.forEach((v, k) => { obj[k] = v; });
  return obj;
}, [pageDimensions]);
```

### 2. Simplified PDF Loading Effect
**Problem**: Too many dependencies and store setters in the load effect caused constant re-runs.

**Solution**: Reduced dependencies to only essential ones:
```typescript
// Before
useEffect(() => {...}, [pdfUrl, setNumPages, setPdfUrl, setDocumentLoading, onLoadSuccess]);

// After
useEffect(() => {...}, [pdfUrl, isDocumentReady]);
```

### 3. Fixed Cleanup Lifecycle
**Problem**: Cleanup effect was running on every `pdfUrl` change, causing load→cleanup→load cycles.

**Solution**: Only cleanup on true component unmount:
```typescript
// Before (ran on every pdfUrl change)
useEffect(() => {
  return () => { cleanup(); };
}, [pdfUrl]);

// After (only on unmount)
useEffect(() => {
  return () => { cleanup(); };
}, []); // Empty dependency array
```

### 4. Removed Callback Dependencies from useMemo
**Problem**: Callback functions in dependencies changed on every render.

**Solution**: Inlined event handlers instead of using callback references:
```typescript
// Before (unstable callback dependencies)
onMouseDown={handlePageMouseDown}

// After (inline handlers)
onMouseDown={(e) => { /* inline logic */ }}
```

### 5. Added Guards Against Duplicate Loading
**Problem**: Same PDF was being loaded multiple times.

**Solution**: Added checks to prevent reloading already loaded documents:
```typescript
if (loadedUrlRef.current === pdfUrl && isDocumentReady) {
  console.log('PDF already loaded, skipping');
  return;
}
```

## Result
- ✅ No more infinite loops
- ✅ No more browser freezing  
- ✅ Stable memory usage
- ✅ PDF loads correctly
- ✅ Viewport-based lazy loading works
- ✅ Performance suitable for large PDFs (1000+ pages)
