“Mental-models map” for the DeepRecall project. First a set of one-liners, then per-package deep cuts: how to think about them, how to scale them, and where to be careful—especially about Zustand ↔ React Query loops.

# Mental models — one-liners

- **Next.js (App Router):** server-first React; routes are files; data boundaries at server actions/route handlers.
- **Zustand:** tiny global stores; read via selectors; write via actions; slice stores to keep domains independent.
- **TanStack Query (React Query):** cache + fetch/mutate state machine for async data; invalidation is the dial.
- **Dexie (IndexedDB):** local, durable, structured KV/collections with transactions; browser-side database.
- **Drizzle ORM + SQLite:** typesafe schema + queries; treat DB as an implementation detail behind a repository.
- **pdfjs-dist:** PDF to viewports and text runs; normalized coordinates are the contract.
- **Zod:** runtime validation + TS inference; define contracts once at the boundary.
- **Web Crypto (SubtleCrypto):** content addressing (SHA-256) as identity; rename-proof keys.
- **FSRS (ts-fsrs):** scheduler math; inputs are last review + rating; output is next due/interval.
- **Zustand middlewares (persist, subscribeWithSelector):** durability and fine-grained reactions without re-render storms.

## Library/CMS Domain Structure

- **Blob:** Minimal file object in server SQLite; for data movement between website and hard disk. Content-addressed by SHA-256.
- **Asset:** Metadata entity in Dexie referencing a Blob; carries role, filename, semantic metadata, and publication details. Three states: (1) Work-linked (has `workId`), (2) Edge-linked (no `workId`, has "contains" edges), (3) Unlinked (standalone, needs linking). Assets are now the primary file containers under Works.
- **Work:** Conceptual metadata container (textbook/paper identity). Not a file directly—everything derives from Assets/Blobs.
- **Activity:** Larger container (course/project); links Works and Assets via Edges.
- **Collection:** Curation/grouping mechanism (future feature).

---

# Next.js (App Router)

**Mental model**
File = route. Server components are default; client components opt-in. Route handlers (or server actions) are the API. Data flows **from server to client**; mutations go back via actions/handlers.

**Scaling**

- Keep **domain routers**: `/api/files`, `/api/blob`, `/api/scan`.
- Encapsulate server logic in **modules** (e.g., `/server/cas`, `/server/db`) called by route handlers.
- Use **typed request/response** with Zod at the boundary.

**Caution**

- Mixing server/client casually leads to bundle bloat. Keep heavy libs on server (sharp, better-sqlite3, pdf parsing).
- Avoid long-running CPU in route handlers during user navigation; push scans to background endpoints and show progress via polling.

---

# Zustand

**Mental model**
A store is a tiny “island of truth” for **UI state** and **ephemeral domain state** (selections, mode, dialog state, in-progress annotation). Read with **selectors**; write with **actions**. No reducers, no boilerplate.

**Scaling**

- **Slice by domain** (annotationStore, viewerStore, srsSessionStore).
- Export **selectors** (pure getters) and **actions** (pure setters/commands).
- Use `subscribeWithSelector` to run side-effects **outside React** (e.g., analytics, keyboard bindings) without re-renders.
- Use `persist` middleware only for **small** durable UI prefs (theme, layout). Durable data (cards, annotations) belongs in Dexie.

**Caution**

- **Do not mirror server data** (e.g., lists from `/files`) inside Zustand. That’s React Query’s job.
- Avoid “store of everything.” If a value can be derived from other sources (props, query data), don’t keep it in the store.
- Infinite re-render traps: selectors that create new objects every render; memoize or select primitives.

---

# TanStack Query (React Query)

**Mental model**
A **cache + finite-state machine** for remote/async data. Each query key owns freshness, retries, background refetch. Mutations are intent; **invalidation** triggers staleness → refetch. It manages loading/error/sync states so React doesn’t have to.

**Scaling**

- One **query client**; strict **key conventions**: `['files']`, `['blobHead', sha256]`, `['fts', sha256, page]`.
- Co-locate **hooks per domain**: `useFilesQuery()`, `useScanMutation()`.
- Use `select` to shape data **without** copying into Zustand.
- Use `onSuccess` to **invalidate minimal keys**, not global nukes.

**Caution**

- **Zustand ↔ Query loops**: avoid writing query results into Zustand, then invalidating queries from a store subscription. Pick one source of truth:
  - Remote data → **React Query only**
  - Ephemeral/UI data → **Zustand**

- Don’t cache unbounded blobs; keep large binary behind streaming endpoints.

---

# Dexie (IndexedDB)

**Mental model**
A **local database** in the browser for **durable client data** (annotations, cards, review logs, doc metadata). Supports indexed queries and transactions. Think “mini SQLite” but asynchronous and schema-versioned.

**Scaling**

- One DB with multiple tables: `docmeta`, `annotations`, `cards`, `reviewlogs`.
- Migrate with `db.version(n).upgrade(tx => …)`.
- Write **repositories**: `annotationRepo.add()`, `cardRepo.listDue()` that hide Dexie calls.

**Caution**

- IndexedDB quotas vary; request persistence via StorageManager.
- Do not store heavy images; persist only metadata and hashes; keep blobs on the server.
- All Dexie ops are async; wrap in hooks (`useLiveQuery`) sparingly to avoid frequent re-renders.

---

# Drizzle ORM + SQLite (server)

**Mental model**
Schema-first, typesafe SQL. Treat it as **infrastructure**, not app state. The CAS server holds only **blobs and paths** (hash→file), not annotations/cards.

**Scaling**

- Keep tables tiny: `blobs`, `paths` (optionally `fts_pages`).
- Expose only stable read APIs to the client (`/files`, `/blob/:hash`).

**Caution**

- Long scans can block a route handler if run inline. Use a separate `/scan` trigger plus background task (or chunked scanning).

---

# pdfjs-dist

**Mental model**
A PDF “decoder” producing **pages** with viewports and optional **text runs**. Rendering is a canvas job; text selection uses transform matrices. Store **normalized** rects so zoom is irrelevant.

**Scaling**

- One worker. Optionally OffscreenCanvas for render off the main thread.
- A **page cache** (LRU of bitmaps) to navigate large docs smoothly.

**Caution**

- Avoid re-rendering pages when overlays change—overlays should be DOM/SVG above the canvas.
- Text extraction is expensive; throttle.

---

# Zod

**Mental model**
Single source of truth for **runtime validation** and **TypeScript types** at boundaries (API input/output, Dexie records).

**Scaling**

- Put schemas in `/schema`. Export both `zodSchema` and `type Schema = z.infer<typeof zodSchema>`.
- Validate request bodies in API handlers; validate Dexie records on import/export.

**Caution**

- Over-zodding every internal function adds friction; limit to boundaries and persistence.

---

# Web Crypto (SubtleCrypto)

**Mental model**
**Content addressing**: SHA-256 digest of bytes/strings as identity. Hashes become primary keys and dedupe keys.

**Scaling**

- One `hashBytes` helper; hex encoding as standard.
- For annotation IDs, hash the **normalized rect list** deterministically.

**Caution**

- Browser hashing is async; batch when generating many IDs to avoid blocking the UI.

---

# FSRS (ts-fsrs)

**Mental model**
Given last review, difficulty/stability, and rating (1–4), compute next **interval** and **due**. Deterministic upgrade of card state.

**Scaling**

- Wrap in `schedule(card, rating, now)`; keep scheduler pure (no I/O).
- Store only card state + logs in Dexie; derive session view in React.

**Caution**

- Latency capture is valuable signal; keep it but do not let it block UI.

---

## How the pieces fit (and avoid loops)

**Golden rule:**

- **Server/remote** data → **React Query** (and only there).
- **Local durable** data (annotations/cards) → **Dexie** (queried via hooks or repo functions).
- **Ephemeral/UI** state → **Zustand**.
  Each domain has **one** source of truth.

**Common anti-patterns and fixes**

- _Anti-pattern:_ On query success, copying results into Zustand to “share them app-wide.”
  _Fix:_ Export a `useFilesQuery()` hook and read it wherever needed; or derive small bits with `select`.
- _Anti-pattern:_ A store `subscribe` that invalidates queries, whose `onSuccess` writes back to the store → ping-pong.
  _Fix:_ Only **mutations** trigger invalidations. Store subscriptions should not call invalidation; put that in UI event handlers or mutation callbacks.

---

## Minimal boundaries checklist

- **Remote:** `/files`, `/blob/:hash`, `/scan` → TanStack Query.
- **Local durable:** annotations/cards/logs → Dexie repositories.
- **UI:** selection, tool mode, page number, deck session state → Zustand slices.
- **Crossing boundaries:** validate with Zod; identify with SHA-256; never duplicate ownership.

---

## Tiny patterns (sketches, comments are impersonal)

**Zustand slice (annotation UI only)**

```ts
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

type Tool = "pan" | "highlight" | "rect" | "note";

interface AnnotationUIState {
  tool: Tool;
  activePage: number;
  setTool: (t: Tool) => void;
  setActivePage: (p: number) => void;
}

export const useAnnotationUI = create<AnnotationUIState>()(
  subscribeWithSelector((set) => ({
    tool: "pan",
    activePage: 1,
    setTool: (t) => set({ tool: t }),
    setActivePage: (p) => set({ activePage: p }),
  }))
);
```

**React Query for server files**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

const Files = z.array(
  z.object({
    sha256: z.string(),
    size: z.number(),
    mime: z.string(),
    mtime_ms: z.number(),
  })
);
type Files = z.infer<typeof Files>;

export function useFilesQuery() {
  return useQuery({
    queryKey: ["files"],
    queryFn: async () => {
      const r = await fetch("/api/files");
      const j = await r.json();
      return Files.parse(j);
    },
    staleTime: 60_000,
  });
}

export function useScanMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await fetch("/api/scan", { method: "POST" })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files"] }),
  });
}
```

**Dexie repository (annotations)**

```ts
import { db } from "./dexie";
export const annotationRepo = {
  byDoc: (sha256: string) =>
    db.annotations.where("sha256").equals(sha256).toArray(),
  put: (ann: Annotation) => db.annotations.put(ann),
  remove: (id: string) => db.annotations.delete(id),
};
```

These three layers do not write into each other; they are read independently in components and coordinated by UI events.

---

## File and responsibility separation (bird’s-eye)

```
/app
    /library                # UI: files grid (React Query)
    /reader                 # UI: pdfjs viewer + overlays (Zustand for UI only)
    /dashboard              # UI: SRS review (Dexie + FSRS)
/public                     # Images, banners, icons, etc.; mostly UI decorations
/src
    /api                    # Next route handlers (server)
    /server
        cas.ts              # scan, hash, stream
        db.ts               # drizzle/better-sqlite3
    /schema
        files.ts, ann.ts    # zod schemas (shared)
    /stores
        annotation-ui.ts    # Zustand slices only for ephemeral UI
        viewer-ui.ts
    /repo
        annotations.ts      # Dexie repositories (durable local data)
        cards.ts
    /srs
        fsrs.ts             # pure scheduler helpers
    /utils
        hash.ts, coords.ts  # Web Crypto, normalized math
```

---

## Quick “when in doubt” rules

1. If it lives on disk or comes from the server → **React Query**.
2. If it must survive page reload locally but is “mine” → **Dexie**.
3. If it controls rendering or interactions right now → **Zustand**.
4. Validate at every boundary; **never** duplicate ownership across layers.
5. Invalidate with intent; do not mirror caches into stores.

That’s the mental scaffolding. With these boundaries, the app stays small in the head yet scales in features without entanglement.
