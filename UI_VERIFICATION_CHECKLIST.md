# UI & Functionality Verification Checklist

**Purpose:** Verify all hoisted components have matching UI and working functionality.

**Format:** `[ ]` = Not tested | `[U]` = UI mismatch | `[F]` = Functionality broken | `[✓]` = Verified working

---

## Library Components (Hoisted to packages/ui)

### Core Dialogs & Forms

- [ ] **LinkBlobDialog** - Link orphaned blob to work
  - UI: _Check modal size, layout, buttons, tabs_
  - Func: _Test linking to existing work, creating new work_
- [ ] **CreateWorkDialog** - Create new work with asset
  - UI: _Check form layout, preset selector, author input_
  - Func: _Test work creation with file upload_
- [ ] **EditWorkDialog** - Edit existing work metadata
  - UI: _Check form fields match preset, layout_
  - Func: _Test editing work fields, saving changes_
- [ ] **CreateActivityDialog** - Create new activity
  - UI: _Check modal layout, form fields_
  - Func: _Test activity creation_

### Template/Preset Management

- [ ] **TemplateLibrary** - Browse and manage templates
  - UI: _Check grid layout, cards, system vs user sections_
  - Func: _Test template selection, initialization_
- [ ] **PresetManager** - Full preset CRUD interface
  - UI: _Check list layout, buttons, forms_
  - Func: _Test create/edit/delete presets_
- [ ] **PresetFormBuilder** - Dynamic form builder for presets
  - UI: _Check field builder UI, drag handles, add buttons_
  - Func: _Test adding/removing/reordering fields_
- [ ] **QuickPresetDialog** - Quick preset creation
  - UI: _Check compact form layout_
  - Func: _Test preset creation shortcut_
- [ ] **PresetSelector** - Select preset from list
  - UI: _Check dropdown/grid layout_
  - Func: _Test preset selection_
- [ ] **TemplateEditorModal** - Edit template fields
  - UI: _Check field editor layout_
  - Func: _Test field modifications_

### Dynamic Forms

- [ ] **DynamicForm** - Render form from preset schema
  - UI: _Check field rendering, spacing, labels_
  - Func: _Test form submission with various field types_
- [ ] **CompactDynamicForm** - Compact form variant
  - UI: _Check compact layout, reduced spacing_
  - Func: _Test form submission_
- [ ] **FieldRenderer** - Individual field renderer
  - UI: _Check text, number, date, select, textarea fields_
  - Func: _Test all field types, validation_

### Work Display Components

- [ ] **WorkCardDetailed** - Full work card with metadata
  - UI: _Check card size, image, metadata layout, buttons_
  - Func: _Test edit, delete, favorite, file operations_
- [ ] **WorkCardCompact** - Minimal work card
  - UI: _Check compact layout, truncation_
  - Func: _Test basic interactions_
- [ ] **WorkCardList** - Work grid/list container
  - UI: _Check grid spacing, responsive layout_
  - Func: _Test drag-drop, sorting, filtering_
- [ ] **WorkSelector** - Select work from list
  - UI: _Check selection UI, work preview_
  - Func: _Test work selection_

### Author Management

- [ ] **AuthorInput** - Search/add authors
  - UI: _Check input field, dropdown, chips_
  - Func: _Test author search, adding new authors, parsing "Last, First"_
- [ ] **AuthorLibrary** - Browse all authors
  - UI: _Check author list/grid, stats, filters_
  - Func: _Test author viewing, editing, merging_

### Import/Export & Data Management

- [ ] **BibtexImportModal** - Import from BibTeX
  - UI: _Check textarea, preview, error display_
  - Func: _Test parsing BibTeX, creating works from entries_
- [ ] **BibtexExportModal** - Export to BibTeX
  - UI: _Check export options, preview_
  - Func: _Test generating BibTeX from works_
- [ ] **ImportDataDialog** - Import data from JSON
  - UI: _Check file selector, progress, options_
  - Func: _Test importing works/presets/authors_
- [ ] **ExportDataDialog** - Export data to JSON
  - UI: _Check entity selector, options_
  - Func: _Test exporting selected entities_

### File & Blob Management

- [ ] **FileInbox** - Drag-drop file upload
  - UI: _Check dropzone, file list, upload progress_
  - Func: _Test file upload, drag-drop, hash calculation_
- [ ] **OrphanedBlobs** - View blobs without assets
  - UI: _Check blob list, thumbnail previews, buttons_
  - Func: _Test linking blobs, deletion_
- [ ] **UnlinkedAssetsList** - Assets not linked to works
  - UI: _Check asset list, metadata display_
  - Func: _Test linking assets to works_
- [ ] **PDFThumbnail** - Thumbnail preview of PDF
  - UI: _Check thumbnail size, loading state, fallback_
  - Func: _Test PDF rendering, caching_
- [ ] **PDFPreviewModal** - Full PDF preview modal
  - UI: _Check modal size, viewer controls_
  - Func: _Test PDF navigation, zoom, page controls_

### Layout & Navigation

- [ ] **LibraryHeader** - Top header with stats
  - UI: _Check stats display, buttons, spacing_
  - Func: _Test stat updates, button actions_
- [ ] **LibraryLeftSidebar** - Left navigation sidebar
  - UI: _Check nav items, icons, active states_
  - Func: _Test navigation, counters update_
- [ ] **LibraryFilters** - Filter controls
  - UI: _Check filter buttons, chips, dropdowns_
  - Func: _Test filtering works by various criteria_
- [ ] **ActivityBanner** - Activity display banner
  - UI: _Check banner layout, card injection_
  - Func: _Test activity display_

### Utility Modals

- [ ] **InputModal** - Generic input prompt
  - UI: _Check modal size, input field, buttons_
  - Func: _Test text input, confirmation_
- [ ] **MessageModal** - Generic message display
  - UI: _Check message layout, icon, buttons_
  - Func: _Test displaying messages, confirmation_

---

## Apps/Web Wrappers (Next.js specific)

### Verified Wrappers

- [✓] **LinkBlobDialog** - Props injection works correctly
  - Fixed: Added `workSelectorOps` prop injection

---

## Common Issues Found

### UI Issues

- _Document specific tailwind class mismatches here_

### Functionality Issues

- _Document broken features and fixes here_

---

## Testing Procedure

**For each component:**

1. **Visual Check:**

   - Open component in browser
   - Compare with git history pre-migration
   - Check responsive behavior (mobile, tablet, desktop)
   - Verify dark theme styles

2. **Functionality Check:**

   - Test all interactive elements (buttons, inputs, dropdowns)
   - Test form submission/validation
   - Test data fetching/mutations
   - Check error handling
   - Verify Electric sync updates UI in real-time

3. **Document Issues:**
   - Mark component status: `[U]` for UI issues, `[F]` for functionality issues
   - Add 1-2 line note describing the problem
   - Add 1-2 line note describing the fix after resolved
   - Mark `[✓]` when fully verified

---

## Project Structure Guide

**Where to find code:**

- **Electric Repos**: `packages/data/src/repos/*.electric.ts` - Database operations
  - Import via `@deeprecall/data/repos`
- **Electric Hooks & Stores**: `packages/data/src/hooks/*.ts` - React hooks for data fetching/mutations
  - Import via `@deeprecall/data/hooks`
- **Core Types & Schemas**: `packages/core/src/` - Shared types, Zod schemas, utilities
  - Import via `@deeprecall/core` or `@deeprecall/core/schemas/library`
- **Platform-Agnostic UI**: `packages/ui/src/**` - Reusable React components
  - Import via `@deeprecall/ui` or `@deeprecall/ui/library/*`
- **Next.js Wrappers**: `apps/web/app/**` - Platform-specific component wrappers
- **Next.js Utils**: `apps/web/src/` - Web-specific hooks, utilities, server code
