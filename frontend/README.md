# DeepRecall Frontend

Clean, local-first architecture following the mental models in `MentalModels.md`.

## Structure

```
app/                    # Next.js App Router
  layout.tsx           # Root layout
  page.tsx             # Home page
  providers.tsx        # React Query provider
  globals.css          # Global styles
  library/             # Library view
  reader/              # PDF reader (stub)
  review/              # SRS review (stub)
  api/                 # API routes
    files/             # GET /api/files
    scan/              # POST /api/scan
    blob/[sha256]/     # GET /api/blob/:sha256

src/
  schema/              # Zod schemas (single source of truth)
    files.ts           # File/blob schemas
    annotations.ts     # Annotation schemas
    cards.ts           # SRS card schemas
  
  db/
    dexie.ts           # Dexie database setup
  
  repo/                # Dexie repositories
    annotations.ts     # Annotation CRUD
    cards.ts           # Card + review log CRUD
  
  stores/              # Zustand slices (ephemeral UI state only)
    annotation-ui.ts   # Annotation tool state
    viewer-ui.ts       # Viewer zoom/sidebar state
  
  hooks/
    useFilesQuery.ts   # React Query hooks for server data
  
  utils/
    hash.ts            # Web Crypto (SHA-256)
    coords.ts          # Coordinate normalization
  
  srs/
    fsrs.ts            # FSRS scheduler helpers
```

## Design Principles

### Separation of Concerns

1. **Remote/server data** → React Query (`useFilesQuery`)
2. **Local durable data** → Dexie repositories (`annotationRepo`, `cardRepo`)
3. **Ephemeral/UI state** → Zustand stores (`useAnnotationUI`, `useViewerUI`)

### Never mix these layers!

- Don't copy React Query results into Zustand
- Don't mirror Dexie data in Zustand
- Each domain has ONE source of truth

### Key Patterns

- **Content addressing**: SHA-256 hashes as primary keys everywhere
- **Normalized coordinates**: Store annotations as 0..1 values (zoom-independent)
- **Deterministic IDs**: Re-imports don't duplicate data
- **Validate at boundaries**: Zod schemas for all external data

## Getting Started

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev
```

## Next Steps

1. Implement SQLite backend (`/api/files`, `/api/scan`, `/api/blob`)
2. PDF.js viewer with normalized overlays
3. Annotation capture and card generation
4. FSRS review loop

See `Pitch.md` and `MentalModels.md` for full context.
