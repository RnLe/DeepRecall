# DeepRecall — Project Overview (High-Level Pitch)

**Tagline:** Read once. Remember for years.
**One-liner:** A local-first PDF study workbench that turns textbook highlights and figures into spaced-repetition drills—without a heavy backend.

---

## Problem

Serious learners (math/physics) swim in PDFs—textbooks, papers, notes. Highlights pile up; understanding fades. Traditional SRS is powerful but tedious to author. Existing tools either lock data behind clouds or slow down iteration with heavy CMS backends.

---

## Solution

**DeepRecall** couples a **tiny content-addressable server** (for bytes) with a **local-first client** (for knowledge).
Annotate directly in PDFs (text highlights, figure rectangles, notes). Those annotations become **card candidates** and **parameterized mini-exercises**. Review them with a physics-aware SRS loop (FSRS). All knowledge stays on the machine; the backend only maps **file hashes → blobs**.

---

## Who it’s for

* Grad students, researchers, and autodidacts in math/physics/CS who read PDFs daily and want durable retention and nimble iteration.
* Single-user, desktop Chrome, Windows + WSL2. Offline-friendly.

---

## Core User Flows

1. **Library ingest**
   Drop PDFs into a watched folder → server scans & hashes → library updates instantly.

2. **Read & annotate**
   Open a PDF; highlight text or draw rectangles around plots/tables; add quick notes/tags.
   Coordinates are stored **normalized** (0..1), so annotations are zoom-proof.

3. **Generate drills**
   Each annotation proposes card candidates (equation cloze, concept check, step-cloze, unit check, graph/figure ID). Accept/edit in seconds.

4. **Review**
   Daily queue with FSRS. Keyboard-first grading, latency capture, leech handling. Deep links jump back to the exact page/annotation.

5. **Own the data**
   Knowledge lives locally (IndexedDB + weekly JSON backups). Big bytes (PDFs, thumbnails) are served by hash from the local server.

---

## Why this is different

* **Content-addressed backend:** renames don’t matter; identical files dedupe automatically.
* **Local-first knowledge:** zero lock-in; fast iteration; offline works.
* **Physics-aware ergonomics:** LaTeX preserved, dimensional checks encouraged, figure crops as first-class citizens.
* **Deterministic IDs:** re-imports don’t duplicate annotations/cards.

---

## MVP Scope (what “done” looks like)

* Library view from `/files` (hash, size, mime, page count).
* PDF viewer with **normalized overlays** (highlights, rectangles, notes).
* Card generator for cloze/concept/step/units + FSRS review loop.
* CAS endpoints: `/scan`, `/files`, `/blob/:sha256`, `/backup`.

---

## Architecture Snapshot

* **Client (Next.js/React, local-first):**

  * UI & ephemeral state: **Zustand** slices (no prop drilling).
  * Server data (lists/scan): **TanStack Query** cache/fetch.
  * Durable knowledge (annotations/cards/logs): **Dexie** (IndexedDB).
  * Scheduler: **FSRS** (TypeScript).
  * Rendering: **pdfjs-dist** (worker; normalized coords).

* **Server (Next.js API routes + SQLite):**

  * Hashing & scan: Node `crypto` + `chokidar`.
  * Storage: **SQLite** via **Drizzle** + `better-sqlite3`.
  * Tables: `blobs(hash, size, mime, mtime, page_count?)`, `paths(hash, path)`.

**Boundary contract:** hash (SHA-256) is the join key everywhere.

---

## Guardrails (design principles)

* **One source of truth per domain:**

  * Remote bytes → React Query.
  * Local durable knowledge → Dexie.
  * UI/ephemeral → Zustand.
* **Idempotence:** deterministic IDs for annotations/cards; regeneration never duplicates.
* **Keyboard-first:** capture and review without touching the mouse.
* **Exportable:** weekly JSON backups into the library folder.

---

## Success Criteria

* **Friction:** capture→card in under **5 seconds** on average.
* **Recall:** 30-day retention > **85%** on core decks (measured via FSRS logs).
* **Throughput:** comfortably handle **1–5k annotations** across **hundreds of PDFs** with smooth navigation.
* **Resilience:** wipe browser cache, restore from last backup, and regain full state in **<2 minutes**.

---

### TL;DR for a new dev

It’s a single-user study tool: **annotate PDFs → generate cards → review with SRS**.
Data split is deliberate: **server stores bytes by hash**, **browser owns knowledge**.
Keep domains separate, types tight, and IDs deterministic. The rest stays simple.
