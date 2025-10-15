# Quick Start Guide

## ✅ Setup Complete

Your DeepRecall project has been restructured with clean architecture following the mental models in `MentalModels.md`.

## Architecture Overview

### Three-Layer Separation

1. **Server/Remote Data** (React Query)
   - Files list, scan operations
   - Lives in: `src/hooks/useFilesQuery.ts`
   - API: `app/api/files/`, `app/api/scan/`, `app/api/blob/`

2. **Local Durable Data** (Dexie/IndexedDB)
   - Annotations, cards, review logs
   - Lives in: `src/db/dexie.ts`, `src/repo/`

3. **Ephemeral UI State** (Zustand)
   - Tool selection, zoom level, active page
   - Lives in: `src/stores/`

**Rule: Never duplicate data between layers!**

## File Structure

```
src/
├── schema/         Zod schemas (boundaries)
├── db/             Dexie setup
├── repo/           Dexie repositories
├── stores/         Zustand slices
├── hooks/          React Query hooks
├── utils/          Pure utilities
└── srs/            FSRS scheduler

app/
├── layout.tsx      Root layout
├── page.tsx        Home page
├── library/        File browser
├── reader/         PDF viewer (stub)
├── review/         SRS session (stub)
└── api/            API routes (stubs)
```

## Running

```bash
pnpm dev
```

Visit http://localhost:3000

## Next Steps

### 1. Backend (SQLite + CAS)

- [ ] Setup Drizzle + better-sqlite3
- [ ] Implement `/api/files` (query blobs table)
- [ ] Implement `/api/scan` (hash files, insert to DB)
- [ ] Implement `/api/blob/:hash` (stream file by hash)

### 2. PDF Viewer

- [ ] PDF.js worker setup
- [ ] Canvas rendering with page cache
- [ ] SVG overlay layer (normalized coords)
- [ ] Annotation tools (highlight, rect, note)

### 3. Card Generation

- [ ] Annotation → card proposals
- [ ] Card editor
- [ ] Save to Dexie

### 4. Review Loop

- [ ] FSRS integration
- [ ] Daily queue
- [ ] Keyboard grading
- [ ] Deep links

## Key Files to Know

- `MentalModels.md` - Architecture philosophy
- `Pitch.md` - Project vision
- `src/schema/*.ts` - Type definitions
- `src/stores/*.ts` - UI state
- `src/repo/*.ts` - Data access

## Dependencies

Core stack:

- Next.js 15 + React 19
- TanStack Query (server cache)
- Zustand (UI state)
- Dexie (local DB)
- Zod (validation)
- pdfjs-dist (rendering)
- Tailwind CSS
- Lucide React (icons)

## Design Principles

✅ Content-addressed (SHA-256 everywhere)
✅ Normalized coordinates (0..1)
✅ Deterministic IDs (no duplication)
✅ Type-safe boundaries (Zod)
✅ Single source of truth per domain

---

**Ready to build!** Start with implementing the SQLite backend, then move to the PDF viewer.
