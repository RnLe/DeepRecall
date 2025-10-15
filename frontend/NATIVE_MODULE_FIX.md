# SQLite Native Binding Fix

## The Problem

`better-sqlite3` is a native Node.js addon (`.node` binary). Next.js instrumentation runs in **both Node.js and Edge runtimes**, and any top-level imports of native modules cause the Edge build to fail with "Could not locate the bindings file."

## The Solution

We implemented **lazy initialization** to ensure the native module is only loaded in the Node.js runtime:

### 1. **Lazy DB initialization** (`src/server/db.ts`)

- Removed top-level `import Database from "better-sqlite3"`
- Created `getDB()` function that uses `require()` to load the module on first use
- Exported `db` as a Proxy that calls `getDB()` on property access
- This ensures the native module is never loaded during module evaluation

### 2. **Async initialization hook** (`src/server/init.ts`)

- Removed top-level import of `db.ts`
- Made `initializeServer()` async
- Uses dynamic import: `await import("./db")` inside the function
- This prevents module evaluation during Edge instrumentation

### 3. **Guarded instrumentation** (`instrumentation.ts`)

- Already correctly checks `process.env.NEXT_RUNTIME === "nodejs"`
- Now awaits the async `initializeServer()`

### 4. **Runtime declaration** (`app/api/health/route.ts`)

- Added `export const runtime = "nodejs"`
- Ensures the route never runs in Edge runtime

### 5. **External package config** (`next.config.ts`)

- `serverExternalPackages: ["better-sqlite3"]` already configured
- Tells Next.js/Turbopack not to bundle the native addon

## Why This Works

- **Edge instrumentation** evaluates `instrumentation.ts` but skips the Node.js-only branch
- **Node.js instrumentation** lazy-loads the DB module only when needed
- **Route handlers** explicitly run in Node.js runtime where native modules work
- **Turbopack/Webpack** don't bundle `better-sqlite3`, so Node can load the `.node` file directly

## Testing

1. From repo root: `docker compose down -v`
2. Rebuild: `docker compose up --build`
3. Visit: http://localhost:3000/api/health

Expected response:

```json
{
  "ok": true,
  "db": "connected",
  "blobs": 0,
  "paths": 0
}
```

## Key Principles

✅ **Never import native modules at top level in instrumentation or server init**
✅ **Use lazy loading (dynamic import or require) for native deps**
✅ **Declare `runtime = "nodejs"` in routes that use native modules**
✅ **Mark native packages as external in next.config.ts**

This pattern works for any native Node.js addon, not just better-sqlite3.
