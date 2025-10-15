# The Real Issue: pnpm + Native Modules

## Problem

`better-sqlite3` (and other native Node.js addons) failed to load with:

```
Error: Could not locate the bindings file
```

## Root Cause

**pnpm's default `node-linker=isolated`** creates a symlinked `node_modules` structure:

```
node_modules/
  .pnpm/
    better-sqlite3@12.4.1/node_modules/better-sqlite3/  ← actual files
  better-sqlite3/  ← symlink
```

Native modules use **relative paths** to load `.node` binaries:

```js
require("./build/Release/better_sqlite3.node");
```

These relative paths **break with symlinks** because `require.resolve()` operates from the symlink location, not the actual file location.

## Solution

One line in `.npmrc`:

```
node-linker=hoisted
```

This creates a **flat structure** like npm:

```
node_modules/
  better-sqlite3/
    build/Release/better_sqlite3.node  ← no symlinks
```

Now relative paths work! ✅

## Why Prebuilt Binaries Didn't Help

The package **does** have prebuilt binaries for Node 22 / Linux x64. They downloaded fine. The issue wasn't the binary—it was **module resolution** with symlinks.

## Lessons Learned

1. **Native modules need flat node_modules** (npm-style)
2. **pnpm's isolated linker breaks native modules** by default
3. **Always check module resolution** before assuming build issues
4. **Test with `node-linker=hoisted`** first when using pnpm + native addons

## Alternatives

- Use **npm** instead of pnpm (flat by default)
- Use **Bun** (handles native modules better)
- Avoid native modules (use WASM alternatives)

## For This Project

We use **pnpm with `node-linker=hoisted`** because:

- Fast installs (pnpm)
- Native module compatibility (hoisted linker)
- No need to switch package managers

---

**TL;DR:** pnpm's symlinks broke `better-sqlite3`. Setting `node-linker=hoisted` fixed it. One line. That's it.
