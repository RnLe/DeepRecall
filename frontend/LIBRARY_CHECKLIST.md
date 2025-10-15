# Library Implementation Checklist

## ✅ Completed (Phase 1: Schema & Foundation)

### Core Schema

- [x] `Work` entity schema with Zod validation
- [x] `Version` entity schema with Zod validation
- [x] `Asset` entity schema with Zod validation
- [x] `Activity` entity schema with Zod validation
- [x] `Collection` entity schema with Zod validation
- [x] `Edge` entity schema with Zod validation
- [x] `Person` schema (lightweight)
- [x] Union type for all library entities
- [x] Type guards for discriminated unions
- [x] Extended types with resolved relations

### Database Layer

- [x] Dexie database with 6 new tables
- [x] Indexed fields for efficient queries
- [x] Maintained existing annotation/card tables
- [x] Version 1 schema definition

### Repository Layer

- [x] Works repository (CRUD + search)
- [x] Versions repository (CRUD + read/favorite)
- [x] Assets repository (CRUD + hash lookups)
- [x] Activities repository (CRUD + date queries)
- [x] Collections repository (CRUD + tag queries)
- [x] Edges repository (CRUD + relation management)
- [x] Barrel export for all repos

### React Integration

- [x] React Query hooks for all entities
- [x] Live queries with `useLiveQuery`
- [x] Mutations with cache invalidation
- [x] Hooks for common operations

### Utilities

- [x] Display name formatters
- [x] Citation string generator
- [x] File size formatter
- [x] Activity date utilities
- [x] Sorting comparators
- [x] Type utilities

### Documentation

- [x] Comprehensive schema documentation
- [x] Usage examples
- [x] Migration guide from Strapi
- [x] Quick reference guide
- [x] Implementation summary

### Quality Assurance

- [x] Zero TypeScript compilation errors
- [x] Zero Strapi dependencies
- [x] Strong typing throughout
- [x] Zod validation at boundaries
- [x] Clean separation of concerns

---

## ✅ Completed (Phase 2: Server Integration)

### Server-Side

- [x] API endpoint to list scanned blobs (`/api/library/blobs`)
- [x] API endpoint to get blob metadata (`/api/library/metadata/[hash]`)
- [x] PDF metadata extraction with pdfjs-dist
- [x] Enriched blob responses with page counts

### Client-Side

- [x] Hook to fetch blobs from server (`useBlobs`)
- [x] Function to create Asset from blob hash (`createAssetFromBlob`)
- [x] Function to detect orphaned blobs/assets
- [x] Function to detect duplicate files (same hash)
- [x] Smart matching and auto-linking utilities
- [x] Batch processing for multiple blobs

### Documentation

- [x] Phase 2 implementation summary
- [x] Phase 2 quick reference guide

---

## ✅ Completed (Phase 3: UI Components - Part 1)

### Library Page

- [x] Work grid view with responsive layout
- [x] Work card component with metadata display
- [x] Search bar with live filtering
- [x] Filter by work type (8 types)
- [x] Sort options (title, date, author)
- [x] Favorites toggle
- [x] Orphaned blobs section
- [x] Empty states
- [x] Library header with stats
- [x] Modern, minimal dark neutral design

### Documentation

- [x] UI components README
- [x] Library UI implementation summary

---

## 🔲 To Do (Phase 3: UI Components - Part 2)

### Linking System

- [x] "Link blob to work" dialog
- [x] Smart blob matching suggestions
- [x] Create Work from blob flow
- [ ] Create Version from blob flow
- [ ] Create Asset from blob flow
- [ ] Batch linking for multiple blobs

### Preset System (NEW) ✅ COMPLETE

- [x] Preset entity schema (defines form templates)
- [x] Preset repository and hooks
- [x] Preset manager UI (create/edit/delete presets via QuickPresetDialog)
- [x] Dynamic form generator based on preset
- [x] User-created presets (system presets removed)
- [x] Add `metadata` field to Work/Version/Asset schemas

### Creation Forms

- [x] "Create Work" dialog with preset selection
- [x] Work cards show preset information
- [x] Left sidebar with collections/activities/presets
- [x] Right sidebar (reserved for future)
- [x] Asset creation optional (works can exist without files)
- [ ] "Add Version" dialog
- [ ] "Add Asset" dialog
- [ ] Version list component
- [ ] Asset thumbnail component

### Work Detail Page

- [ ] Work metadata display
- [ ] Author list
- [ ] Version tabs
- [ ] Asset list per version
- [ ] Edit metadata form
- [ ] Delete work button
- [ ] Collections this work is in

### Collection Page

- [ ] Collection grid/list view
- [ ] Collection card component
- [ ] "Create Collection" dialog
- [ ] Add/remove works to collection
- [ ] Reorder items (if ordered)
- [ ] Collection color/icon picker

### Activity Page

- [ ] Activity grid/list view
- [ ] Activity card component
- [ ] "Create Activity" dialog
- [ ] Add/remove works to activity
- [ ] Timeline view for activities
- [ ] Active/upcoming/past filters

---

## 🔲 To Do (Phase 4: Import/Export)

### Import

- [ ] Import Works from JSON
- [ ] Import Versions from JSON
- [ ] Import Collections from JSON
- [ ] Import Activities from JSON
- [ ] Import from old Strapi backup
- [ ] Validate imported data
- [ ] Handle ID conflicts
- [ ] Preserve relations (edges)

### Export

- [ ] Export all library data to JSON
- [ ] Export single Work with versions
- [ ] Export collection with works
- [ ] Export activity with assigned works
- [ ] Weekly automatic backup
- [ ] Save backup to library folder

---

## 🔲 To Do (Phase 5: Search & Discovery)

### Search

- [ ] Full-text search across Works
- [ ] Search by author
- [ ] Search by topic/tag
- [ ] Search by publication year
- [ ] Search by DOI/ISBN
- [ ] Search in Collections
- [ ] Search in Activities

### Discovery

- [ ] Related works (by topic)
- [ ] Works citing this work
- [ ] Works cited by this work
- [ ] Prerequisite chain visualization
- [ ] Similar works (by author overlap)

---

## 🔲 To Do (Phase 6: Testing)

### Unit Tests

- [ ] Repository function tests
- [ ] Validation tests (Zod schemas)
- [ ] Type guard tests
- [ ] Utility function tests

### Integration Tests

- [ ] Create Work → Version → Asset flow
- [ ] Collection management flow
- [ ] Activity assignment flow
- [ ] Edge creation/deletion flow

### E2E Tests

- [ ] Library page interactions
- [ ] Work creation flow
- [ ] Collection creation flow
- [ ] Search functionality

---

## 📊 Progress Summary

| Phase                  | Progress | Files | Lines |
| ---------------------- | -------- | ----- | ----- |
| 1. Schema & Foundation | ✅ 100%  | 15    | 2,500 |
| 2. Server Integration  | ✅ 100%  | 6     | 790   |
| 3. UI Components       | 🟡 75%   | 13    | 1,650 |
| 4. Import/Export       | 🔲 0%    | -     | -     |
| 5. Search & Discovery  | 🔲 0%    | -     | -     |
| 6. Testing             | 🔲 0%    | -     | -     |

**Overall Progress:** 2.75/6 phases complete (Phase 3 mostly done)

---

## Next Steps

**Immediate (Phase 3 - Part 2):**

1. Design Preset entity schema for flexible form templates
2. Add `metadata` field to Work/Version/Asset for custom fields
3. Create "Link blob to work" dialog with smart suggestions
4. Implement dynamic form generator based on preset
5. Create default presets (Paper, Textbook, Thesis, etc.)
6. Build "Create Work from blob" flow

**Then (Phase 3 - Part 3):**

1. Version management UI
2. Asset management UI
3. Work detail page
4. Collection integration

---

**Status:** Phase 1 complete ✅ - Ready to build UI on top of this foundation.
