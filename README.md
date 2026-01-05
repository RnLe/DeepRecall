# DeepRecall

**A unified platform for academic reading, annotation, note-taking, and spaced repetition learning.**

DeepRecall aims to combine the functionality of **Anki + GoodNotes + PDF Expert + Google Scholar** into a single, offline-first application — designed to reduce friction between reading papers, taking notes, and creating study material.

## Vision

- **Read** PDFs with rich annotation tools (ink, highlights, area selections)
- **Connect** papers and textbooks via citation trees and knowledge graphs
- **Annotate** with AI assistance (describe figures, convert equations to LaTeX, explain concepts)
- **Note** freely with a whiteboard module (Apple Pencil support, replaces GoodNotes/OneNote)
- **Learn** through automatically generated flashcards with spaced repetition
- **Cross-reference** annotations across your entire library (e.g., "all papers using this Hamiltonian")

All platforms (Web, Desktop, iOS) share a single codebase with offline-first sync.

---

## Current State

> **Status: Preview / Halted Development**

This project is not actively maintained. I'm releasing it as a reference implementation and potential starting point for others.
Current updates only focus on bringing it to a robust "preview" state.

**Why development stopped:**

1. **RemNote exists.** It covers most of the same ground (PDF annotation, note-taking, SRS; yet it misses the paper dependency and knowledge-graph features) and is actively developed.

2. **Exponential complexity.** Each module (PDF rendering, whiteboard/inking, sync, SRS, knowledge graphs) is a project in itself. Reaching a usable beta would require months of focused work.

**Current focus:**
I continue building **_research tools_** and other **_scientific_** and **_machine learning applications_** in other domains — see [Blaze2D](https://rnle.github.io/blaze2d/blaze/), a 2D Maxwell eigensolver.

---

## Platforms & Deployment

DeepRecall runs on three platforms: **Web**, **Desktop** (Tauri), and **iOS** (Capacitor).  
All share the same UI — only platform-specific code differs (e.g., native file handling).

### Web

The web app is hosted on [Railway](https://deeprecall-production.up.railway.app) and doubles as the API gateway for the desktop and mobile apps. A PostgreSQL database and ElectricSQL service handle persistent storage and real-time sync.

### Desktop

The Tauri desktop app is available for download directly from [GitHub Releases](https://github.com/RnLe/DeepRecall/releases).

### iOS

A **closed TestFlight beta** exists. Apple's App Store policies make open distribution difficult — an open beta would allow invite-link access, but this requires additional review steps.

The iOS app is designed for **iPad + Apple Pencil**. Since the UI is shared across all platforms, the experience is functionally identical to web and desktop.

---

## Architecture

```
apps/
├── web/        # Next.js (production deployment)
├── desktop/    # Tauri (native macOS/Windows/Linux)
└── mobile/     # Capacitor (iOS, Apple Pencil support)

packages/       # Everything that is shared across apps
├── core/       # Shared types, schemas, utilities
├── data/       # Offline-first sync (ElectricSQL + Dexie)
├── ui/         # React components (library, reader, study)
├── pdf/        # PDF.js rendering utilities
└── whiteboard/ # Inking engine (Pixi.js)
```

**Key technical decisions:**

- **Offline-first**: Local writes → optimistic UI → background sync → Postgres via ElectricSQL
- **Content-addressed storage**: PDFs stored by SHA-256 hash (deduplication, immutable URLs)
- **Shared codebase**: Platform-specific code injected via adapters; UI is entirely shared between platforms

See [README_DEV.md](README_DEV.md) for full architecture documentation.

---

## What Works

- Full PDF viewing with page rendering and text selection
- Highlight and area annotations
- Whiteboard/notes module with inking (Apple pencil support)
- Cross-platform sync (Web ↔ Desktop ↔ iOS)
- OAuth authentication (Google, GitHub)
- Dojo (learning) preview

## What's Incomplete

- Citation tree / dependency graph visualization
- AI annotation features (image description, LaTeX conversion)
- Cross-reference search across annotations
- Collaborative editing
- Full file-upload support
- Inking features (infinite canvas, formats, background color + pattern, etc.)
- Dojo features (adding decks, cards, exercises, etc.)

---

## License

MIT — feel free to fork, learn from, or continue this project.
