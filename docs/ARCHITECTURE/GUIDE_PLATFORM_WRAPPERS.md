# Platform Wrapper Pattern

> **Blueprint for organizing platform-specific code across Web, Desktop, and Mobile apps**

---

## Architecture

```
packages/ui/ → Platform-agnostic React components (use Electric hooks)
apps/web/ → Next.js (Web)
apps/desktop/ → Tauri (Desktop)
apps/mobile/ → Capacitor (Mobile)
```

**Key Principle**: UI components in `packages/ui/` are platform-agnostic. Platform-specific adapters live in `apps/{platform}/`.

---

## Folder Structure per Route

```
apps/{platform}/app/{route}/
├── page.tsx # Route orchestrator
├── _components/ # Platform-specific wrappers only
│ ├── Component1.tsx # Wrapper with operations interface
│ ├── Component2.tsx # Wrapper with operations interface
│ └── ...
```

**Rules:**

- ✅ `page.tsx` = Orchestrator (layout, routing, platform-specific hooks)
- ✅ `_components/` = Adapters (inject platform-specific data/operations)
- ❌ NO trivial re-exports (import directly from `@deeprecall/ui` instead)

---

## Import Pattern in page.tsx

Use **3 clear sections** with comments:

```tsx
"use client";

// ========================================
// PURE UI IMPORTS (from @deeprecall/ui)
// ========================================
import {
 AuthorInput,
 CreateWorkDialog,
 TemplateLibrary,
 WorkSelector,
 // ... all platform-agnostic components
} from "@deeprecall/ui";

// ========================================
// PLATFORM WRAPPERS (from ./_components)
// ========================================
import { LibraryHeader } from "./_components/LibraryHeader";
import { LibraryLeftSidebar } from "./_components/LibraryLeftSidebar";
// ... components requiring platform-specific operations

// ========================================
// PLATFORM HOOKS (from @/src/hooks)
// ========================================
import { useOrphanedBlobs } from "@/src/hooks/useBlobs";
import { useBlobStats } from "@/src/hooks/useBlobs";
// ... platform-specific data hooks
```

---

## When to Create a Wrapper

**Create a wrapper in `_components/` if:**

- ✅ Component needs platform-specific data (APIs, filesystem, native features)
- ✅ Component needs platform-specific operations (navigation, blob URLs, CAS)
- ✅ Component uses platform-specific hooks (React Query, Tauri, Capacitor)

**Import directly from `@deeprecall/ui` if:**

- ✅ Component only uses Electric hooks (useWorks, useAssets, etc.)
- ✅ Component has zero platform-specific code
- ✅ Component is pure UI with callbacks only

---

## Example Wrapper

```tsx
// apps/web/app/library/_components/LibraryHeader.tsx
"use client";

import {
 LibraryHeader as LibraryHeaderUI,
 type LibraryHeaderOperations,
} from "@deeprecall/ui";
import { useBlobStats } from "@/src/hooks/useBlobs";

export function LibraryHeader() {
 const blobStats = useBlobStats();

 const operations: LibraryHeaderOperations = {
 blobStats,
 onClearDatabase: async () => {
 await fetch("/api/library/clear", { method: "POST" });
 },
 };

 return <LibraryHeaderUI operations={operations} />;
}
```

---

## Multi-Platform Strategy

**Shared (`packages/ui/`):**

- All Electric hooks usage
- All business logic
- All UI components
- All utilities

**Platform-specific (`apps/{platform}/`):**

- Server API calls (Web: fetch, Desktop: Tauri commands, Mobile: Capacitor plugins)
- Filesystem access (platform-specific APIs)
- Navigation (Next.js router, Tauri router, Capacitor router)
- Native features (camera, notifications, etc.)

**Reusability:**

All three platforms implement the same `ComponentOperations` interface from `@deeprecall/ui`, but with platform-specific code:

- Web: `apps/web/app/library/_components/Component.tsx`
- Desktop: `apps/desktop/src/library/_components/Component.tsx`
- Mobile: `apps/mobile/src/library/_components/Component.tsx`

---

## Key Benefits

1. **Clear separation** - Platform-agnostic vs platform-specific instantly visible
2. **Zero duplication** - Shared UI code lives in one place (`packages/ui`)
3. **Easy platform additions** - Copy wrapper folder structure, implement operations
4. **Grep-friendly** - Find all platform code: `find . -path "*/_components/*"`
5. **Self-documenting** - Code structure explains architecture

---

## See Also

- [`GUIDE_DATA_ARCHITECTURE.md`](GUIDE_DATA_ARCHITECTURE.md) - Platform injection pattern for CAS adapters
