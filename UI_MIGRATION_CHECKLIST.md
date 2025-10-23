# UI Component Migration Checklist

**Goal:** Extract React UI components from `apps/web/app/*` to `packages/ui` to share across Web (Next.js), Desktop (Tauri), and Mobile (Capacitor).

---

## 🚨 CRITICAL PRIORITY: UI & Functionality Verification

**Before continuing migration, ALL hoisted components must be verified:**

1. **UI Match (1:1):** Tailwind classes in `packages/ui` components MUST exactly match original `apps/web` versions. No visual regressions.
2. **Functionality Test:** All features (create/edit/delete works, presets, etc.) must work identically to pre-migration state.

**Verification Checklist:** See `UI_VERIFICATION_CHECKLIST.md` for detailed component-by-component testing.

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

### ✅ Can Move As-Is (No Next.js dependencies)

**library/**

- [x] `AuthorInput.tsx` - ✅ Converted with AuthorOperations interface + Hoisted
- [x] `BibtexExportModal.tsx` - ✅ Converted with BibtexExportOperations interface + Electric hooks + Hoisted
- [x] `BibtexImportModal.tsx` - ✅ Converted with BibtexImportOperations interface + Hoisted
- [x] `CompactDynamicForm.tsx` - ✅ Hoisted (pure form using preset utilities)
- [x] `DynamicForm.tsx` - ✅ Hoisted (pure form using preset utilities)
- [x] `FieldRenderer.tsx` - ✅ Hoisted (pure field renderer)
- [x] `InputModal.tsx` - ✅ Pure component + Hoisted
- [x] `MessageModal.tsx` - ✅ Pure component + Hoisted
- [x] `PDFThumbnail.tsx` - ✅ Hoisted with getBlobUrl and usePDF injection
- [x] `PresetFormBuilder.tsx` - ✅ Hoisted (already uses Electric hooks)
- [x] `PresetSelector.tsx` - ✅ Pure component + Hoisted (with utility function)
- [x] `WorkCardCompact.tsx` - ✅ Converted to use Electric hooks (useDeleteWork, usePresets, useAuthorsByIds) from @deeprecall/data/hooks + Hoisted to packages/ui/src/library/
- [x] `WorkCardDetailed.tsx` - ✅ Converted to use Electric hooks (useDeleteWork, usePresets) from @deeprecall/data/hooks
- [x] `WorkCardList.tsx` - ✅ Hoisted with navigation adapter

**reader/**

- [ ] `AnnotationEditor.tsx` - Pure editor
- [ ] `AnnotationList.tsx` - Pure list
- [ ] `AnnotationToolbar.tsx` - Pure toolbar
- [ ] `CompactNoteItem.tsx` - Pure item
- [ ] `CreateNoteDialog.tsx` - Pure dialog
- [ ] `MarkdownPreview.tsx` - Pure preview
- [ ] `NoteConnectors.tsx` - Pure visual
- [ ] `NoteDetailModal.tsx` - Pure modal
- [ ] `NotePreview.tsx` - Pure preview
- [ ] `PDFPage.tsx` - PDF.js wrapper (check deps)
- [ ] `PDFPreview.tsx` - PDF.js wrapper
- [ ] `PDFScrollbar.tsx` - Pure scrollbar
- [ ] `PDFTextLayer.tsx` - PDF.js layer
- [ ] `PDFThumbnail.tsx` - Pure thumbnail
- [ ] `SimplePDFViewer.tsx` - PDF.js viewer

### ⚠️ Need Adapter (Next.js dependencies)

**library/**

- [x] `ActivityBanner.tsx` - ✅ Hoisted with card components as props
- [x] `AuthorLibrary.tsx` - ✅ Split into multiple components + Hoisted with AuthorLibraryOperations interface
- [x] `CreateActivityDialog.tsx` - ✅ Hoisted with Electric mutation injection
- [x] `CreateWorkDialog.tsx` - ✅ Converted to Electric hooks (useWorkPresets, useCreateWorkWithAsset, useAuthorsByIds, useFindOrCreateAuthor) + Hoisted to packages/ui/src/library/
- [x] `EditWorkDialog.tsx` - Check for routing
- [x] `ExportDataDialog.tsx` - ✅ Converted with ExportOperations interface + Hoisted
- [x] `FileInbox.tsx` - ✅ Converted to platform-agnostic with props + Hoisted
- [x] `ImportDataDialog.tsx` - ✅ Converted with ImportOperations interface + Hoisted
- [x] `LibraryFilters.tsx` - ✅ Hoisted (pure component)
- [x] `LibraryHeader.tsx` - ✅ Hoisted with BlobStats interface
- [x] `LibraryLeftSidebar.tsx` - ✅ Converted to Electric + BlobOperations pattern + Hoisted
- [x] `LinkBlobDialog.tsx` - ✅ Converted to Electric hooks + Hoisted
- [x] `OrphanedBlobs.tsx` - ✅ Hoisted with OrphanedBlobsOperations pattern
- [x] `PDFPreviewModal.tsx` - ✅ Hoisted with PDFPreview component injection
- [x] `PresetManager.tsx` - ✅ Hoisted (already uses Electric hooks)
- [x] `QuickPresetDialog.tsx` - ✅ Hoisted (already uses Electric hooks)
- [x] `TemplateEditorModal.tsx` - ✅ Converted with TemplateEditorOperations interface + Hoisted
- [x] `TemplateLibrary.tsx` - ✅ Converted to Electric hooks + Hoisted
- [x] `UnlinkedAssetsList.tsx` - ✅ Converted to Electric hooks + UnlinkedAssetsOperations pattern + Hoisted
- [x] `WorkContextMenu.tsx` - Check for navigation
- [x] `WorkSelector.tsx` - ✅ Converted to use Electric hooks (useAuthorsByIds) + Hoisted to packages/ui/src/library/ (still uses useWorksExtended until full Assets migration)
- [x] **`page.tsx`** - ✅ Main library page - Already uses Electric hooks (useWorks, useAssets, useActivities, useCreateEdge) and composes all hoisted components. Orchestration component kept in apps/web as Next.js page.

**reader/**

- [ ] `AnnotationContextMenu.tsx` - Pure menu likely
- [ ] `AnnotationHandlers.tsx` - Event handlers
- [ ] `AnnotationOverlay.tsx` - SVG overlay
- [ ] `FileList.tsx` - Check for Link usage
- [ ] `NoteSidebar.tsx` - Check for navigation
- [ ] **`page.tsx`** - Next.js page wrapper
- [ ] `PDFViewer.tsx` - Main viewer component
- [ ] `ReaderLayout.tsx` - Layout component
- [ ] `TabBar.tsx` - Pure tabs likely
- [ ] `TabContent.tsx` - Pure content likely
- [ ] `annotation/[annotationId]/page.tsx` - Next.js dynamic route

**study/**

- [ ] **`page.tsx`** - Next.js page wrapper

**admin/**

- [x] **`page.tsx (AdminPanel)`** - ✅ Hoisted to packages/ui/src/library/AdminPanel.tsx + Converted to Electric hooks (useBlobsMeta, useDeviceBlobs) + Shows multi-device blob coordination + Zero UI regression
- [x] **`DuplicateResolutionModal.tsx`** - ✅ Hoisted to packages/ui/src/library/DuplicateResolutionModal.tsx + Platform-agnostic modal for duplicate file resolution + Exported types (DuplicateGroup, DuplicateResolutionModalProps)

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

**Goal:** Create Next.js-agnostic and platform-agnostic UI components that use Electric SQL for real-time sync

**Architecture:**

- **Electric Repos**: `packages/data/src/repos/*.electric.ts` - Direct Electric SQL operations (create, update, delete)
  - Import via `@deeprecall/data/repos`
- **Electric Hooks & Stores**: `packages/data/src/hooks/*.ts` - React hooks wrapping Electric repos with React Query
  - Import via `@deeprecall/data/hooks`
- **Core Types & Schemas**: `packages/core/src/` - Shared types, Zod schemas, and utilities
  - Import via `@deeprecall/core` or `@deeprecall/core/schemas/library`
- **Platform-Agnostic UI**: `packages/ui/src/**` - Pure React components with operations interfaces
  - Import via `@deeprecall/ui` or `@deeprecall/ui/library/*`
- **Platform Wrappers**: `apps/web/app/**` - Next.js-specific wrappers that inject Electric hooks into UI components

**Web-Specific Infrastructure Hooks** (remain in `apps/web/src/hooks/`):
These hooks bridge server-side APIs with Electric-synced data and are specific to the Next.js web app:

- `useBlobs.ts` - Bridges server blob storage API (`/api/library/blobs`) with Electric-synced assets
  - `useBlobStats()` - Combines server blob API + Electric assets for statistics
  - `useOrphanedBlobs()` - Server blobs not yet in asset database (uses Electric `useAssets()` internally)
  - `useUnlinkedAssets()` - Assets not linked to works/activities (uses Electric `useAssets()` + `useEdges()`)
  - `useOrphanedAssets()` - Assets referencing deleted blobs
  - `useDuplicateAssets()` - Multiple assets with same hash
- `usePDF.ts` - PDF.js integration (local implementation, will move to `@deeprecall/pdf`)
- `useWorksExtended()` - Complex join query (pending full migration to Electric)

**Task:** Incremental UI migration - convert components to use Electric hooks first, extract to packages/ui second

**Completed:**

1. ✅ `library/page.tsx` - Converted to use Electric hooks (useWorks, useAssets, useActivities, useCreateEdge) from @deeprecall/data/hooks
2. ✅ `library/LinkBlobDialog.tsx` - Converted to use Electric hooks + Hoisted to packages/ui/src/library/
3. ✅ `library/TemplateLibrary.tsx` - Converted to use Electric hooks (all presets operations) from @deeprecall/data/hooks + Hoisted to packages/ui/src/library/
4. ✅ `library/WorkCardList.tsx` - Converted to use Electric hooks + Hoisted to packages/ui/src/library/
5. ✅ `library/FileInbox.tsx` - Made platform-agnostic + Hoisted to packages/ui/src/library/
6. ✅ `library/LibraryLeftSidebar.tsx` - Converted to use Electric hooks + Hoisted to packages/ui/src/library/
7. ✅ `library/ImportDataDialog.tsx` - Made platform-agnostic + Hoisted to packages/ui/src/library/
8. ✅ `library/ExportDataDialog.tsx` - Made platform-agnostic + Hoisted to packages/ui/src/library/
9. ✅ `library/AuthorInput.tsx` - Made platform-agnostic + Hoisted to packages/ui/src/library/
10. ✅ `library/AuthorLibrary.tsx` - Split into modular components + Hoisted to packages/ui/src/library/
11. ✅ `library/BibtexImportModal.tsx` - Made platform-agnostic + Hoisted to packages/ui/src/library/
12. ✅ `library/BibtexExportModal.tsx` - Made platform-agnostic + Hoisted to packages/ui/src/library/
13. ✅ `library/InputModal.tsx` - Pure component + Hoisted to packages/ui/src/library/
14. ✅ `library/MessageModal.tsx` - Pure component + Hoisted to packages/ui/src/library/
15. ✅ `library/TemplateEditorModal.tsx` - Made platform-agnostic + Hoisted to packages/ui/src/library/
16. ✅ `library/WorkCardDetailed.tsx` - Converted to use Electric hooks (useDeleteWork, usePresets, useAuthorsByIds) from @deeprecall/data/hooks + Hoisted to packages/ui/src/library/
17. ✅ `library/WorkCardCompact.tsx` - Converted to use Electric hooks (useDeleteWork, usePresets, useAuthorsByIds) from @deeprecall/data/hooks + Hoisted to packages/ui/src/library/
18. ✅ `library/CreateActivityDialog.tsx` - Converted to use Electric hooks (useCreateActivity) from @deeprecall/data/hooks
19. ✅ `library/EditWorkDialog.tsx` - Converted to use Electric hooks (useUpdateWork, useWorkPresets, useAuthorsByIds) from @deeprecall/data/hooks + Hoisted to packages/ui/src/library/
20. ✅ `library/CreateWorkDialog.tsx` - Converted to use Electric hooks (useCreateWorkWithAsset, useWorkPresets, useAuthorsByIds, useFindOrCreateAuthor) from @deeprecall/data/hooks + Hoisted to packages/ui/src/library/
21. ✅ `library/PresetFormBuilder.tsx` - Converted to use Electric hooks (useCreatePreset) from @deeprecall/data/hooks
22. ✅ `library/QuickPresetDialog.tsx` - Converted to use Electric hooks (useCreatePreset) from @deeprecall/data/hooks
23. ✅ `library/PresetManager.tsx` - Converted to use Electric hooks (all preset operations) from @deeprecall/data/hooks
24. ✅ `library/WorkSelector.tsx` - Converted to use Electric hooks (useAuthorsByIds) from @deeprecall/data/hooks + Hoisted to packages/ui/src/library/

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
