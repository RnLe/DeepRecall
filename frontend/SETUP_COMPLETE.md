# DeepRecall - Project Setup Complete ✅

## What Was Done

### 1. **Cleaned Package Dependencies**
Removed unnecessary packages from `package.json`:
- ❌ Apollo Client (GraphQL)
- ❌ Capacitor (mobile)
- ❌ Google APIs
- ❌ Highlight.run
- ❌ Strapi-related packages
- ❌ Canvas/HTML2Canvas/jsPDF
- ❌ Redux
- ❌ Many others...

**Kept only essentials:**
- ✅ Next.js 15 + React 19
- ✅ TanStack Query (React Query)
- ✅ Zustand
- ✅ Dexie + dexie-react-hooks
- ✅ Zod
- ✅ pdfjs-dist
- ✅ KaTeX + react-markdown
- ✅ Lucide React (icons)
- ✅ Tailwind CSS
- ✅ ts-fsrs (placeholder for now)

### 2. **Created Clean Folder Structure**

```
src/
├── schema/              # Zod schemas - single source of truth
│   ├── files.ts        # File/blob API contracts
│   ├── annotations.ts  # Annotation structure
│   └── cards.ts        # SRS card + review log
├── db/
│   └── dexie.ts        # IndexedDB setup
├── repo/               # Dexie repositories (local durable data)
│   ├── annotations.ts  # Annotation CRUD
│   └── cards.ts        # Card CRUD + review logs
├── stores/             # Zustand slices (ephemeral UI only!)
│   ├── annotation-ui.ts # Tool selection, active page
│   └── viewer-ui.ts    # Zoom, sidebar state
├── hooks/
│   └── useFilesQuery.ts # React Query hooks for server
├── utils/
│   ├── hash.ts         # SHA-256 content addressing
│   └── coords.ts       # Normalized rect conversion
└── srs/
    └── fsrs.ts         # FSRS scheduler (placeholder)
```

### 3. **Implemented Core Architecture Patterns**

Following your **MentalModels.md**:

#### ✅ **Separation of Concerns**
- **Server/Remote** → React Query (`useFilesQuery`, `useScanMutation`)
- **Local Durable** → Dexie repos (`annotationRepo`, `cardRepo`)
- **Ephemeral UI** → Zustand stores (`useAnnotationUI`, `useViewerUI`)

#### ✅ **Content Addressing**
- SHA-256 hashing utilities in `utils/hash.ts`
- All primary keys are content hashes

#### ✅ **Normalized Coordinates**
- Annotations stored as 0..1 values (zoom-independent)
- Helper functions in `utils/coords.ts`

#### ✅ **Type Safety**
- Zod schemas for all boundaries
- TypeScript throughout

### 4. **Created Simple App Pages**

```
app/
├── layout.tsx         # Clean root layout
├── page.tsx          # Home with navigation cards
├── providers.tsx     # React Query provider
├── globals.css       # Tailwind base styles
├── library/
│   └── page.tsx      # File list with scan button
├── reader/
│   └── page.tsx      # Placeholder for PDF viewer
├── review/
│   └── page.tsx      # Placeholder for SRS
└── api/              # Stub API routes
    ├── files/route.ts      # GET /api/files
    ├── scan/route.ts       # POST /api/scan
    └── blob/[sha256]/route.ts  # GET /api/blob/:hash
```

### 5. **Key Design Decisions**

✅ **No data duplication between layers**
- Never copy React Query → Zustand
- Never mirror Dexie → Zustand
- Each layer reads from its own source

✅ **Sliced Zustand stores**
- `annotation-ui.ts` - just annotation tools
- `viewer-ui.ts` - just viewer settings
- Easy to scale with more slices

✅ **Repository pattern for Dexie**
- Encapsulates all IndexedDB operations
- Clean API: `annotationRepo.byDoc(hash)`

✅ **Validation at boundaries**
- All API responses validated with Zod
- Dexie types match Zod schemas

## What's Next

### Immediate (Backend)
1. **Implement SQLite backend**
   - Create `src/server/db.ts` with Drizzle
   - Tables: `blobs`, `paths`, optionally `fts_pages`
   - Implement `/api/files`, `/api/scan`, `/api/blob/:hash`

2. **File system watching**
   - Use `chokidar` for library folder monitoring
   - Auto-scan on changes

### Soon (Frontend)
3. **PDF Viewer**
   - PDF.js worker setup
   - Canvas rendering
   - Normalized overlay layer

4. **Annotation Capture**
   - Text selection → highlight
   - Rectangle drawing
   - Note editing
   - Save to Dexie

5. **Card Generation**
   - Annotation → card proposals
   - Quick accept/edit UI

6. **Review Loop**
   - FSRS integration (replace placeholder)
   - Keyboard-first grading
   - Deep links to source

## Running the App

```bash
cd /home/renlephy/DeepRecall/frontend
pnpm dev
```

Visit http://localhost:3000

## Project Health

✅ Clean architecture with clear boundaries
✅ Type-safe throughout
✅ Dependencies pruned (19 → 11 core deps)
✅ Mental models implemented
✅ Ready for feature development
✅ Old code isolated in `old_frontend/` (can delete later)

---

**The foundation is solid. Time to build features! 🚀**
