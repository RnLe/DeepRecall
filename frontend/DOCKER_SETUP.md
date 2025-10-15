# Docker Setup - Clean & Simple

## Overview

The frontend runs in a Node.js Alpine container with pnpm. The key configuration for native modules (better-sqlite3) is in `.npmrc`.

## Structure

### Dockerfile (Minimal)

- **Base image**: `node:22-alpine` (small, efficient)
- **Package manager**: pnpm with `node-linker=hoisted` (for native module compatibility)
- **Build**: Installs dependencies during build (overridden by volume mount in dev)
- **No entrypoint**: Direct `pnpm run dev` startup

### docker-compose.yml

- **Source mount**: `./frontend:/app/` for live code editing
- **Volume masks**: `/app/node_modules` and `/app/.next` to keep container versions
- **Data persistence**: `./data:/app/data` for SQLite database
- **No pnpm-store volume**: Not needed with simple setup

## Key Configuration: .npmrc

```
node-linker=hoisted
```

This single line ensures `better-sqlite3` (and other native modules) work correctly by creating a flat `node_modules` structure instead of pnpm's default symlinked layout.

## About the Symlinks in VS Code

Even with `node-linker=hoisted`, you'll see some symlink arrows in `node_modules` in VS Code. This is **normal and fine**:

- pnpm still uses internal symlinks for deduplication
- The difference is that **package-to-package** links work for relative paths now
- Native bindings can resolve correctly
- You're just seeing pnpm's internal optimizations

Think of it like this:

- **Before (`isolated`)**: Heavy symlink structure that broke native modules
- **After (`hoisted`)**: Light symlink structure (deduplication) that works with native modules

## Development Workflow

```bash
# Start everything
docker compose up --build

# Stop everything
docker compose down

# Clear database and rebuild
docker compose down -v
docker compose up --build

# View logs
docker compose logs frontend -f
```

## What Happens on Startup

1. Docker builds the image with dependencies installed
2. Container starts with volumes mounted:
   - Your source code from `./frontend`
   - Container's `node_modules` (masked from host)
   - Container's `.next` build cache (masked from host)
   - Shared `./data` for SQLite database
3. Next.js dev server starts with hot reload
4. Database initializes lazily on first API call

## Why This Works

- **Alpine is fine**: Native modules work with musl libc (no need for Debian)
- **No rebuild needed**: Prebuilt binaries work with hoisted linker
- **Simple volumes**: No pnpm-store complexity
- **No entrypoint**: Direct startup is faster and cleaner

## Local Development (Outside Docker)

```bash
cd frontend
pnpm install  # Uses the same .npmrc
pnpm dev      # Runs locally
```

VS Code will have full IntelliSense because you have local `node_modules`. The local version and Docker version both use `node-linker=hoisted`, so they're consistent.

---

**TL;DR**: One line in `.npmrc` (`node-linker=hoisted`) + simple Docker setup = native modules work perfectly. No complexity needed.
