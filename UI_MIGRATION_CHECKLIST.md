# UI Component Migration Checklist

**Goal:** Extract React UI components from `apps/web/app/*` to `packages/ui` to share across Web (Next.js), Desktop (Tauri), and Mobile (Capacitor).

---

## 🎯 ARCHITECTURE PHILOSOPHY

**Electric SQL IS the Platform Abstraction Layer**

- ✅ **@deeprecall/data** provides platform-agnostic hooks (useAuthors, useWorks, etc.)
- ✅ **@deeprecall/core** provides shared types and schemas
- ✅ **@deeprecall/ui** provides pure UI components that use @deeprecall/data hooks directly
- ❌ **NO operations interfaces needed** - Electric hooks are already platform-agnostic
- ⚠️ **Thin wrappers ONLY for**: Platform-specific APIs (filesystem, PDF.js, routing, native features)

**If you can swap Electric for another sync layer by only rewriting @deeprecall/data internals, the architecture is correct.**

---

## 🚨 CRITICAL PRIORITY: UI & Functionality Verification

**Before continuing migration, ALL hoisted components must be verified:**

1. **UI Match (1:1):** Tailwind classes in `packages/ui` components MUST exactly match original `apps/web` versions. No visual regressions.
2. **Functionality Test:** All features (create/edit/delete works, presets, etc.) must work identically to pre-migration state.

**Verification Checklist:** See `UI_VERIFICATION_CHECKLIST.md` for detailed component-by-component testing.

---

## 📊 Hoisting Progress Legend

- **[x]** - Initially hoisted (may use operations pattern, not yet revisited)
- **[✓]** - Revisited and optimized for Electric Everywhere architecture
- **🎯** - Fully hoisted (uses @deeprecall packages directly, zero platform-specific code)
- **⚠️** - Needs platform wrapper (requires platform-specific features: filesystem, PDF.js, routing, native APIs)
- **❌** - Cannot move (Next.js/server-specific)

---

## Strategy

### Phase 1: Identify & Categorize

- Audit all components for Next.js dependencies
- Identify components that can move as-is
- Identify components that need adapters

### Phase 2: Create Adapters

- Router adapter (navigation, params, query strings)
- Image adapter (next/image → img or platform-specific)
- Link adapter (next/link → platform routing)

### Phase 3: Migrate Components

- Start with leaf components (no dependencies)
- Move shared utilities first
- Gradually move parent components
- Update imports incrementally

### Phase 4: Update Hooks

- Replace Dexie hooks with Electric hooks
- Update `@/src/hooks/useLibrary` → `@deeprecall/data/hooks`
- Test sync behavior

---

## Component Audit

### ✅ Utilities & Helpers

**packages/ui/src/utils/** (100% platform-agnostic)

- 🎯 `admin.ts` - Admin utilities
- 🎯 `authorDisplay.ts` - Author name formatting
- 🎯 `bibtex.ts` - BibTeX parsing and validation
- 🎯 `bibtexExport.ts` - Work-to-BibTeX conversion
- 🎯 `cache.ts` - Cache utilities
- 🎯 `data-sync.ts` - Data sync helpers
- 🎯 `date.ts` - Date formatting
- 🎯 `library.ts` - Library entity display utilities (getPrimaryAuthors, formatWorkStats, etc.)
- 🎯 `nameParser.ts` - Smart author name parsing
- 🎯 `presets.ts` - Preset utilities
- 🎯 `viewport.ts` - Viewport utilities

**packages/ui/src/components/** (100% platform-agnostic)

- 🎯 `ImageCropper.tsx` - Image cropping component
- 🎯 `PDFPreview.tsx` - Lightweight PDF viewer using @deeprecall/pdf (moved from reader/)
- 🎯 `SimplePDFViewer.tsx` - Floating modal wrapper for PDFPreview (moved from reader/)

### Library Components

**library/** - ✅ COMPLETED (all components hoisted + organized with wrapper pattern)

- [✓] `AuthorInput.tsx` - 🎯 Hoisted to packages/ui/src/library/, wrapper is pure re-export (ZERO platform code!)
- [✓] `BibtexExportModal.tsx` - 🎯 Hoisted to packages/ui/src/library/, wrapper is pure re-export (ZERO platform code!)
- [✓] `BibtexImportModal.tsx` - 🎯 Hoisted to packages/ui/src/library/, wrapper is pure re-export (ZERO platform code!)
- [✓] `CompactDynamicForm.tsx` - 🎯 Hoisted to packages/ui/src/library/, pure form using preset utilities
- [✓] `CreateActivityDialog.tsx` - 🎯 Hoisted to packages/ui/src/library/, wrapper is pure re-export (ZERO platform code!)
- [✓] `CreateWorkDialog.tsx` - 🎯 Hoisted to packages/ui/src/library/, wrapper is pure re-export (ZERO platform code!)
- [✓] `DynamicForm.tsx` - 🎯 Hoisted to packages/ui/src/library/, pure form using preset utilities
- [✓] `EditWorkDialog.tsx` - ⚠️ Hoisted to packages/ui/src/library/, wrapper in \_components/ provides 1 platform op (getBlobUrl)
- [✓] `FieldRenderer.tsx` - 🎯 Hoisted to packages/ui/src/library/, pure field renderer
- [✓] `FileInbox.tsx` - 🎯 Hoisted to packages/ui/src/library/, wrapper is pure re-export (ZERO platform code!)
- [✓] `InputModal.tsx` - 🎯 Hoisted to packages/ui/src/library/, pure component
- [✓] `LibraryFilters.tsx` - 🎯 Hoisted to packages/ui/src/library/, pure component
- [✓] `MessageModal.tsx` - 🎯 Hoisted to packages/ui/src/library/, pure component
- [✓] `PresetFormBuilder.tsx` - 🎯 Hoisted to packages/ui/src/library/, uses Electric hooks directly
- [✓] `PresetManager.tsx` - 🎯 Hoisted to packages/ui/src/library/, uses Electric hooks directly
- [✓] `PresetSelector.tsx` - 🎯 Hoisted to packages/ui/src/library/, pure component with utility function
- [✓] `QuickPresetDialog.tsx` - 🎯 Hoisted to packages/ui/src/library/, uses Electric hooks directly
- [✓] `TemplateEditorModal.tsx` - 🎯 Hoisted to packages/ui/src/library/, wrapper is pure re-export (ZERO platform code!)
- [✓] `TemplateLibrary.tsx` - 🎯 Hoisted to packages/ui/src/library/, wrapper is pure re-export (ZERO platform code!)
- [✓] `WorkContextMenu.tsx` - 🎯 Hoisted to packages/ui/src/library/, pure component
- [✓] `WorkSelector.tsx` - 🎯 Hoisted to packages/ui/src/library/, wrapper is pure re-export (ZERO platform code!)
- [✓] **`page.tsx`** - ✅ Next.js orchestrator - cleaned up with 3-section import pattern, uses wrappers from \_components/

**library/\_components/** (Platform Wrappers - Web-specific)

- [✓] `ActivityBanner.tsx` - ⚠️ Wrapper provides 1 platform op (onDropFiles)
- [✓] `AuthorLibrary.tsx` - ⚠️ Wrapper provides 3 platform ops (avatars, getBlobUrl, navigation)
- [✓] `ExportDataDialog.tsx` - ⚠️ Wrapper provides ExportOperations (server API + Dexie access)
- [✓] `ImportDataDialog.tsx` - ⚠️ Wrapper provides ImportOperations (server API)
- [✓] `LibraryHeader.tsx` - ⚠️ Wrapper provides 2 platform ops (blobStats from server CAS, onClearDatabase for API access)
- [✓] `LibraryLeftSidebar.tsx` - ⚠️ Wrapper provides 7 platform ops (fetchOrphanedBlobs, orphanedBlobs, isLoadingBlobs, fetchBlobContent, renameBlob, deleteBlob, uploadFiles, getBlobUrl)
- [✓] `LinkBlobDialog.tsx` - ⚠️ Wrapper provides 1 platform op (getBlobUrl)
- [✓] `OrphanedBlobs.tsx` - ⚠️ Wrapper provides 3 platform ops (orphanedBlobs data from server CAS, isLoading state, getBlobUrl)
- [✓] `PDFPreviewModal.tsx` - ⚠️ Wrapper provides 1 platform op (getBlobUrl)
- [✓] `PDFThumbnail.tsx` - ⚠️ Wrapper provides 1 platform op (getBlobUrl)
- [✓] `UnlinkedAssetsList.tsx` - ⚠️ Wrapper provides 2 platform ops (renameBlob, fetchBlobContent)
- [✓] `WorkCardCompact.tsx` - ⚠️ Wrapper provides 2 platform ops (navigate, getBlobUrl)
- [✓] `WorkCardDetailed.tsx` - ⚠️ Wrapper provides 2 platform ops (navigate, getBlobUrl)
- [✓] `WorkCardList.tsx` - ⚠️ Wrapper provides 2 platform ops (navigate, getBlobUrl)

**reader/** - ✅ COMPLETED (all components hoisted + organized with wrapper pattern)

- [✓] `AnnotationList.tsx` - 🎯 Hoisted to packages/ui/src/reader/, uses Electric hooks directly
- [✓] `AnnotationToolbar.tsx` - 🎯 Hoisted to packages/ui/src/reader/, pure UI component (Zustand store)
- [✓] `AnnotationContextMenu.tsx` - 🎯 Hoisted to packages/ui/src/reader/, uses Electric hooks directly
- [✓] `AnnotationHandlers.tsx` - 🎯 Hoisted to packages/ui/src/reader/, pure UI component (Zustand store)
- [✓] `FileList.tsx` - 🎯 Hoisted to packages/ui/src/reader/, uses Electric hooks directly
- [✓] `NoteConnectors.tsx` - 🎯 Hoisted to packages/ui/src/reader/, pure visual component
- [✓] `PDFPage.tsx` - 🎯 Hoisted to packages/ui/src/reader/, uses @deeprecall/pdf hooks
- [✓] `PDFScrollbar.tsx` - 🎯 Hoisted to packages/ui/src/reader/, pure UI component
- [✓] `PDFTextLayer.tsx` - 🎯 Hoisted to packages/ui/src/reader/, pure PDF.js wrapper
- [✓] `ReaderLayout.tsx` - 🎯 Hoisted to packages/ui/src/reader/, requires AnnotationEditorComponent injection
- [✓] `TabBar.tsx` - 🎯 Hoisted to packages/ui/src/reader/, uses @deeprecall/data stores
- [✓] **`PDFViewer.tsx`** - ✅ Platform-specific orchestrator - cleaned up with 3-section import pattern, uses wrappers from \_components/
- [✓] **`page.tsx`** - ✅ Next.js orchestrator - uses wrappers from \_components/ and PDFViewer

**reader/\_components/** (Platform Wrappers - Web-specific)

- [✓] `AnnotationEditor.tsx` - ⚠️ Wrapper provides AnnotationEditorOperations (getBlobUrl, fetchBlobContent, createMarkdown, uploadFile, createNoteAsset, attachAssetToAnnotation, updateAssetMetadata)
- [✓] `AnnotationOverlay.tsx` - ⚠️ Wrapper provides 2 platform ops (navigateToAnnotation, uploadAndAttachNote)
- [✓] `CompactNoteItem.tsx` - ⚠️ Wrapper provides 1 platform op (getBlobUrl)
- [✓] `CreateNoteDialog.tsx` - ⚠️ Wrapper provides CreateNoteDialogOperations (createMarkdown, uploadFile, createNoteAsset, attachAssetToAnnotation)
- [✓] `MarkdownPreview.tsx` - ⚠️ Wrapper provides MarkdownPreviewOperations (rendering/fetching)
- [✓] `NoteDetailModal.tsx` - ⚠️ Wrapper provides NoteDetailModalOperations (platform features)
- [✓] `NotePreview.tsx` - ⚠️ Wrapper provides NotePreviewOperations (platform features)
- [✓] `NoteSidebar.tsx` - ⚠️ Wrapper extends NotePreviewOperations
- [✓] `SimplePDFViewer.tsx` - ⚠️ Wrapper provides 1 platform op (getBlobUrl)
- [✓] `TabContent.tsx` - ⚠️ Wrapper injects PDFViewer component and getBlobUrl

### Need Platform Wrappers

**library/** - ✅ COMPLETED (see above for full component list + \_components/ wrappers)

**reader/** - ✅ COMPLETED (see above for full component list + \_components/ wrappers)

**reader/annotation/[annotationId]/**

- [x] `CreateGroupDialog.tsx` - Pure UI component (imported directly from @deeprecall/ui)
- [x] `NoteBranch.tsx` - Needs wrapper (NoteBranchOperations: uploadFile, getBlobUrl, fetchBlobContent - platform-specific)
- [x] `NoteTreeView.tsx` - Needs wrapper (NoteTreeViewOperations extends NoteBranchOperations + group management)
- [x] `AnnotationPreview.tsx` - Needs wrapper (AnnotationPreviewOperations: getBlobUrl, loadPDFDocument - platform-specific)
- [ ] `page.tsx` - Next.js dynamic route (implements operations for all annotation components)

**study/**

- [ ] **`page.tsx`** - Next.js page wrapper

**admin/**

- [x] **`AdminPanel.tsx`** - Uses Electric hooks (useBlobsMeta, useDeviceBlobs) directly
- [x] **`DuplicateResolutionModal.tsx`** - Platform-agnostic modal
- [x] **`page.tsx`** - Next.js page wrapper

### ❌ Cannot Move (Server/Next.js-specific)

**Root:**

- ❌ `layout.tsx` - Next.js app shell
- ❌ `page.tsx` - Next.js home page
- ❌ `providers.tsx` - Next.js client wrapper (but logic can be shared)

**api/\***

- ❌ All API routes - Server-only (will be replaced by different backends)

---

## Migration Priority

### Phase 1: Data Hooks (DONE ✅)

- All repos converted to Electric
- All hooks ready in `packages/data`

### Phase 2: Update Component Hooks (IN PROGRESS)

**Start Here:**

1. [ ] `library/page.tsx` - Main library page
2. [ ] `library/FileInbox.tsx` - File inbox component
3. [ ] Other library components
4. [ ] Reader components
5. [ ] Study components

### Phase 3: Extract to packages/ui (LATER)

- Create routing adapter
- Move components with updated hooks
- Test in all three platforms

---

## Next.js Dependencies to Replace

### Navigation

```tsx
// ❌ Next.js
import { useRouter } from "next/navigation";
const router = useRouter();
router.push("/library");

// ✅ Platform-agnostic (adapter)
import { useNavigation } from "@deeprecall/ui/adapters/navigation";
const navigation = useNavigation();
navigation.navigate("/library");
```

### Links

```tsx
// ❌ Next.js
import Link from "next/link";
<Link href="/reader">Open</Link>;

// ✅ Platform-agnostic (adapter)
import { Link } from "@deeprecall/ui/adapters/Link";
<Link to="/reader">Open</Link>;
```

### Images

```tsx
// ❌ Next.js
import Image from "next/image";
<Image src="/icon.png" alt="Icon" width={24} height={24} />

// ✅ Platform-agnostic
<img src="/icon.png" alt="Icon" className="w-6 h-6" />
```

### API Calls

```tsx
// ❌ Next.js (server route)
fetch("/api/library/upload", ...)

// ✅ Platform-agnostic (backend adapter)
import { uploadFile } from "@deeprecall/ui/adapters/backend";
uploadFile(...)
```

---

## Current Focus

**Goal:** Maximize hoisting - only keep platform-specific code in apps/web

**Architecture:**

- **@deeprecall/data** - Platform-agnostic Electric hooks (useAuthors, useWorks, etc.)
- **@deeprecall/core** - Shared types, Zod schemas, utilities
- **@deeprecall/ui** - Pure React components using @deeprecall packages directly
- **apps/web/app** - Ultra-thin wrappers ONLY for platform-specific features

**Platform-Specific Features (require wrappers):**

- **Filesystem Access**: Blob storage, file uploads, avatar management
- **PDF.js**: Document loading, rendering (will move to @deeprecall/pdf)
- **Routing**: Next.js navigation, dynamic routes
- **Native APIs**: Desktop/Mobile-specific features

**Hoisting Strategy:**

1. ✅ **Utilities**: Move all .ts files to packages/ui/src/utils
2. ✅ **Pure Components**: Move components using only @deeprecall packages
3. 🔄 **Reduce Operations**: Minimize operations interfaces - use Electric hooks directly
4. ⚠️ **Thin Wrappers**: Keep only truly platform-specific code in apps/web

**Web-Specific Infrastructure Hooks** (remain in `apps/web/src/hooks/`):

- `useBlobs.ts` - Server blob storage API bridge
  - `useBlobStats()` - Server blob API + Electric assets
  - `useOrphanedBlobs()` - Server blobs not in asset database
  - `useUnlinkedAssets()` - Assets not linked to works/activities
  - `useOrphanedAssets()` - Assets referencing deleted blobs
  - `useDuplicateAssets()` - Multiple assets with same hash
- `usePDF.ts` - PDF.js integration (will move to @deeprecall/pdf)
- `useWorksExtended()` - Complex join query (pending migration)

**Task:** Incremental UI migration - convert components to use Electric hooks first, extract to packages/ui second

**Completed:**

**library/ - FULL MIGRATION COMPLETE ✅**

_All 28 library components migrated with wrapper pattern established:_

**Platform-Agnostic Components (packages/ui/src/library/):**

1. ✅ `AuthorInput.tsx` - Pure component, uses Electric hooks
2. ✅ `BibtexExportModal.tsx` - Pure component, uses Electric hooks
3. ✅ `BibtexImportModal.tsx` - Pure component, uses utilities
4. ✅ `CompactDynamicForm.tsx` - Pure form using preset utilities
5. ✅ `CreateActivityDialog.tsx` - Pure component, uses Electric hooks
6. ✅ `CreateWorkDialog.tsx` - Pure component, uses Electric hooks
7. ✅ `DynamicForm.tsx` - Pure form using preset utilities
8. ✅ `EditWorkDialog.tsx` - Pure component, uses Electric hooks
9. ✅ `FieldRenderer.tsx` - Pure field renderer
10. ✅ `FileInbox.tsx` - Pure component, imports MarkdownPreview
11. ✅ `InputModal.tsx` - Pure component
12. ✅ `LibraryFilters.tsx` - Pure component
13. ✅ `MessageModal.tsx` - Pure component
14. ✅ `PresetFormBuilder.tsx` - Pure component, uses Electric hooks
15. ✅ `PresetManager.tsx` - Pure component, uses Electric hooks
16. ✅ `PresetSelector.tsx` - Pure component with utility function
17. ✅ `QuickPresetDialog.tsx` - Pure component, uses Electric hooks
18. ✅ `TemplateEditorModal.tsx` - Pure component, uses Electric hooks
19. ✅ `TemplateLibrary.tsx` - Pure component, uses Electric hooks + Zustand
20. ✅ `WorkContextMenu.tsx` - Pure component
21. ✅ `WorkSelector.tsx` - Pure component, uses Electric hooks

**Platform Wrappers (apps/web/app/library/\_components/):** 22. ✅ `ActivityBanner.tsx` - Wrapper provides 1 platform op (onDropFiles) 23. ✅ `AuthorLibrary.tsx` - Wrapper provides 3 platform ops (avatars, getBlobUrl, navigation) 24. ✅ `ExportDataDialog.tsx` - Wrapper provides ExportOperations (server API + Dexie) 25. ✅ `ImportDataDialog.tsx` - Wrapper provides ImportOperations (server API) 26. ✅ `LibraryHeader.tsx` - Wrapper provides 2 platform ops (blobStats, onClearDatabase) 27. ✅ `LibraryLeftSidebar.tsx` - Wrapper provides 7 platform ops (blob operations + uploads) 28. ✅ `LinkBlobDialog.tsx` - Wrapper provides 1 platform op (getBlobUrl) 29. ✅ `OrphanedBlobs.tsx` - Wrapper provides 3 platform ops (orphanedBlobs, isLoading, getBlobUrl) 30. ✅ `PDFPreviewModal.tsx` - Wrapper provides 1 platform op (getBlobUrl) 31. ✅ `PDFThumbnail.tsx` - Wrapper provides 1 platform op (getBlobUrl) 32. ✅ `UnlinkedAssetsList.tsx` - Wrapper provides 2 platform ops (renameBlob, fetchBlobContent) 33. ✅ `WorkCardCompact.tsx` - Wrapper provides 2 platform ops (navigate, getBlobUrl) 34. ✅ `WorkCardDetailed.tsx` - Wrapper provides 2 platform ops (navigate, getBlobUrl) 35. ✅ `WorkCardList.tsx` - Wrapper provides 2 platform ops (navigate, getBlobUrl)

**Orchestrator:** 36. ✅ `page.tsx` - Cleaned up with 3-section import pattern, uses wrappers from \_components/

**reader/ - FULL MIGRATION COMPLETE ✅**

_All reader components migrated with wrapper pattern established:_

**Platform-Agnostic Components (packages/ui/src/reader/):** 37. ✅ `AnnotationList.tsx` - Pure component, uses Electric hooks 38. ✅ `AnnotationToolbar.tsx` - Pure UI component, Zustand store 39. ✅ `AnnotationContextMenu.tsx` - Pure component, uses Electric hooks 40. ✅ `AnnotationHandlers.tsx` - Pure UI component, Zustand store 41. ✅ `FileList.tsx` - Pure component, uses Electric hooks 42. ✅ `NoteConnectors.tsx` - Pure visual component 43. ✅ `PDFPage.tsx` - Pure component, uses @deeprecall/pdf 44. ✅ `PDFScrollbar.tsx` - Pure UI component 45. ✅ `PDFTextLayer.tsx` - Pure PDF.js wrapper 46. ✅ `ReaderLayout.tsx` - Pure component, requires AnnotationEditorComponent injection 47. ✅ `TabBar.tsx` - Pure component, uses @deeprecall/data stores

**Platform Wrappers (apps/web/app/reader/\_components/):** 48. ✅ `AnnotationEditor.tsx` - Wrapper provides 7 platform ops (blob operations + file upload) 49. ✅ `AnnotationOverlay.tsx` - Wrapper provides 2 platform ops (navigation, uploadAndAttachNote) 50. ✅ `CompactNoteItem.tsx` - Wrapper provides 1 platform op (getBlobUrl) 51. ✅ `CreateNoteDialog.tsx` - Wrapper provides 4 platform ops (createMarkdown, uploadFile, createNoteAsset, attachAssetToAnnotation) 52. ✅ `MarkdownPreview.tsx` - Wrapper provides MarkdownPreviewOperations 53. ✅ `NoteDetailModal.tsx` - Wrapper provides NoteDetailModalOperations 54. ✅ `NotePreview.tsx` - Wrapper provides NotePreviewOperations 55. ✅ `NoteSidebar.tsx` - Wrapper extends NotePreviewOperations 56. ✅ `SimplePDFViewer.tsx` - Wrapper provides 1 platform op (getBlobUrl) 57. ✅ `TabContent.tsx` - Wrapper injects PDFViewer + getBlobUrl

**Orchestrators:** 58. ✅ `PDFViewer.tsx` - Platform-specific orchestrator with 3-section import pattern, reduced by 135+ lines (removed operations now handled by wrappers) 59. ✅ `page.tsx` - Next.js orchestrator with 3-section import pattern, uses wrappers from \_components/

**Architecture Established:**

- ✅ PLATFORM_WRAPPER_PATTERN.md blueprint created
- ✅ \_components/ subfolder pattern implemented in library/ AND reader/
- ✅ 3-section import pattern in all page.tsx files (Pure UI / Platform Wrappers / Platform Hooks)
- ✅ All components use Electric hooks from @deeprecall/data
- ✅ Zero operations.ts dependencies (removed legacy aggregation pattern)
- ✅ PDFViewer.tsx cleaned up (removed 135+ lines of operations code)

**Web-Specific Hooks (Remain in @/src/hooks):**

- `useBlobStats()` - Queries server blob API + combines with Electric assets
- `useOrphanedBlobs()` - Queries server blob API + filters by Electric assets
- `useUnlinkedAssets()` - Uses Electric hooks (useAssets, useEdges) internally
- `useOrphanedAssets()` - Combines server blobs with Electric assets
- `useDuplicateAssets()` - Uses Electric hooks (useAssets) internally
- `useWorksExtended()` - Complex join query, pending full migration
- `usePDF()` - Platform-agnostic, already in @deeprecall/pdf

**Components Using Web-Specific Hooks:**

- ✅ `LibraryHeader.tsx` - Uses `useBlobStats()` (internally Electric-powered)
- ✅ `OrphanedBlobs.tsx` - Uses `useOrphanedBlobs()` (internally Electric-powered)
- ✅ `UnlinkedAssetsList.tsx` - Uses `useUnlinkedAssets()` (internally Electric-powered)
- ✅ `PDFThumbnail.tsx` - Uses `usePDF()` from local hooks
- ⚠️ `WorkSelector.tsx` - Uses `useWorksExtended()` (pending full Assets+Versions migration)

**Hooks Updated to Use Electric:**

- `useOrphanedBlobs()` - Now uses Electric `useAssets()` for asset data
- `useUnlinkedAssets()` - Converted to `useMemo` with Electric `useAssets()` + `useEdges()`
- `useOrphanedAssets()` - Now uses Electric `useAssets()` for asset data
- `useDuplicateAssets()` - Now uses Electric `useAssets()` for asset data
- `useBlobStats()` - Now uses Electric hooks for all asset-related stats

**Components Using Updated Hooks:**

- ✅ `LibraryHeader.tsx` - Uses `useBlobStats()` (now Electric-powered)
- ✅ `OrphanedBlobs.tsx` - Uses `useOrphanedBlobs()` (now Electric-powered)
- ✅ `UnlinkedAssetsList.tsx` - Uses `useUnlinkedAssets()` (now Electric-powered)
- ✅ `PDFThumbnail.tsx` - Pure component (no migration needed)
- ⚠️ `WorkSelector.tsx` - Uses `useWorksExtended()` (pending full Assets+Versions migration)

**Preset Initialization:**

- ✅ All Electric-based mutation hooks created in `@deeprecall/data/hooks`
- ✅ Added initialization hooks: `useInitializePresets()`, `useMissingDefaultPresets()`, `useResetSinglePreset()`
- ✅ All hooks are platform-agnostic and use Electric + WriteBuffer pattern
- ✅ No Dexie dependencies - fully compatible with Web, Desktop, and Mobile platforms
- ✅ Updated init-db.sh to note preset initialization (deferred to app startup via UI button)
- ✅ Initialization button in TemplateLibrary still works for manual preset seeding

**Electric Hooks Migration Status:**

- ✅ **ALL 23+ library components** now use Electric hooks from `@deeprecall/data/hooks`
- ✅ **Core data hooks (`useBlobs`)** updated to use Electric internally
- ✅ All mutation hooks use WriteBuffer pattern for optimistic updates
- ✅ **ZERO Dexie dependencies** in library components (except useWorksExtended - pending full migration)
- ✅ Platform-agnostic: Ready for Web (Next.js), Desktop (Tauri), Mobile (Capacitor)
- ✅ Real-time sync with Postgres via Electric SQL
- ✅ All mutation operations (Create, Update, Delete) use Electric WriteBuffer
- ✅ All query operations use Electric ShapeStream for live sync
- ✅ 23+ components fully migrated to Electric hooks
- ✅ 15 components hoisted to `packages/ui` as platform-agnostic components
- ✅ Helper hooks added: `useWorkPresets`, `useVersionPresets`, `useAssetPresets` for filtering by target entity

**Remaining Dexie Usage:**

- ⚠️ `useWorksExtended` - Requires Assets to be fully migrated to Electric (works with versions + assets)
- ⚠️ `WorkSelector.tsx` - Uses `useWorksExtended` (waiting for Assets migration)
- All other components: **100% Electric, 0% Dexie**

**Next Components to Convert:**
Instead of moving entire page with all dependencies at once, we're taking an incremental approach:

1. **Phase 1:** Convert components in apps/web to use Electric hooks (IN PROGRESS)
2. **Phase 2:** Extract individual components to packages/ui with platform adapters
3. **Phase 3:** Wire up Desktop/Mobile apps to use shared components

**Next Steps:**

- Update apps/web/library/page.tsx to keep using Electric hooks ✅ DONE
- Keep components in apps/web for now (too many interdependencies)
- Focus on getting Electric sync working end-to-end first
- Extract components incrementally when building Desktop/Mobile apps

**After This:**

- Components will work with Electric+Postgres
- Can gradually extract to `packages/ui`
- Desktop/Mobile can reuse same components

---

## Status

- ✅ Phase 1: Data hooks converted
- 🔄 Phase 2: Updating component hooks (page.tsx, FileInbox.tsx)
- ⏳ Phase 3: Extract to packages/ui (later)
