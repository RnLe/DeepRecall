# Linting & Build Configuration Reference

This document tracks all locations where linting rules, TypeScript strict mode, and build configurations have been relaxed across the DeepRecall project.

## Quick Reference

| App | TypeScript Strict | ESLint | Build Warnings |
| ------------------- | ----------------- | ---------------------- | ---------------- |
| **Web** | ❌ Disabled | ✅ Next.js defaults | Ignored |
| **Desktop (Tauri)** | ✅ Enabled | Manual suppressions | Warnings allowed |
| **Mobile (iOS)** | ❌ Disabled | Manual suppressions | Warnings allowed |

---

## Web App (`apps/web`)

### TypeScript Configuration

**File**: `apps/web/tsconfig.json`

```json
{
 "compilerOptions": {
 "strict": false, // Disabled for faster development
 "strictNullChecks": true, // ✅ Still enforced
 "noUnusedLocals": false,
 "noUnusedParameters": false
 }
}
```

**Why disabled**: Next.js with large monorepo packages caused too many type conflicts.

### ESLint Configuration

**File**: `apps/web/.eslintrc.json`

```json
{
 "extends": ["next/core-web-vitals", "next/typescript"]
}
```

**Rules**: Uses Next.js defaults (lenient for rapid development).

### Inline ESLint Suppressions

**File**: `apps/web/src/server/pdf.ts`

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const info = infoResult.info as any;
```

**Reason**: PDF metadata types are dynamic.

**File**: `apps/web/src/utils/export-import-web.ts`

```typescript
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
async function calculateConflicts(importCounts: any): Promise<...> {}
```

**Reason**: Stub function for future conflict detection.

### Build Configuration

**File**: `apps/web/next.config.ts`

```typescript
{
 serverExternalPackages: ["pino", "better-sqlite3", "pg", "pg-native"],
 webpack(config) {
 config.resolve.fallback = {
 canvas: false,
 fs: false,
 // ... other Node.js modules stubbed
 };
 }
}
```

**Why**: Stub out Node.js-only modules for client bundles.

---

## Desktop App (`apps/desktop`)

### TypeScript Configuration

**File**: `apps/desktop/tsconfig.json`

```json
{
 "compilerOptions": {
 "strict": true, // ✅ Enabled (Tauri Rust integration)
 "noUnusedLocals": false, // Disabled
 "noUnusedParameters": false // Disabled
 }
}
```

**Why**: Strict mode enabled for Rust FFI type safety, but unused vars disabled for Tauri commands.

### ESLint Configuration

**File**: None (uses TypeScript compiler only)

**Suppressions**: Handled via `// @ts-ignore` or `// eslint-disable-next-line` inline.

### Build Configuration

**File**: `apps/desktop/src-tauri/Cargo.toml`

```toml
[features]
default = ["custom-protocol"]
devtools = [] # DevTools enabled even in release
```

**File**: `apps/desktop/src-tauri/tauri.conf.json`

```json
{
 "app": {
 "windows": [
 {
 "devtools": true // ✅ Enabled in production
 }
 ]
 }
}
```

---

## Mobile App (`apps/mobile`)

### TypeScript Configuration

**File**: `apps/mobile/tsconfig.app.json`

```json
{
 "compilerOptions": {
 "strict": false, // Disabled
 "noUnusedLocals": false,
 "noUnusedParameters": false,
 "verbatimModuleSyntax": false, // Capacitor compatibility
 "erasableSyntaxOnly": false,
 "noUncheckedSideEffectImports": false
 }
}
```

**File**: `apps/mobile/tsconfig.node.json` (same settings)

**Why disabled**: Capacitor plugins use dynamic types and private class fields that conflict with strict mode.

### Build Configuration

**File**: `apps/mobile/vite.config.ts`

```typescript
{
 server: {
 proxy: {
 '/api': {
 target: 'http://localhost:3000',
 changeOrigin: true,
 }
 }
 }
}
```

**Why**: Proxy API requests to web server in browser dev mode.

---

## Shared Packages

### Data Package (`packages/data`)

**File**: `packages/data/tsconfig.json`

```json
{
 "compilerOptions": {
 "strict": true, // ✅ Enabled for shared code
 "declaration": true,
 "declarationMap": true
 }
}
```

**Why**: Strict mode for library code ensures type safety across all consuming apps.

### UI Package (`packages/ui`)

**File**: `packages/ui/tsconfig.json`

```json
{
 "compilerOptions": {
 "strict": true, // ✅ Enabled
 "jsx": "react-jsx"
 }
}
```

---

## How to Modify Configurations

### To Disable TypeScript Strict Mode

```bash
# Edit tsconfig.json
"strict": false
```

### To Suppress Specific ESLint Rules

```typescript
// Inline (single line)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const x: any = {};

// Inline (next line)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function unused() {}

// File-level
/* eslint-disable @typescript-eslint/no-explicit-any */
```

### To Ignore Build Warnings (Next.js)

```typescript
// next.config.ts
{
 eslint: {
 ignoreDuringBuilds: true // Use with caution
 },
 typescript: {
 ignoreBuildErrors: true // Use with caution
 }
}
```

### To Allow Unused Variables

```json
// tsconfig.json
{
 "compilerOptions": {
 "noUnusedLocals": false,
 "noUnusedParameters": false
 }
}
```

---

## Build Commands

### Web App

```bash
cd apps/web
pnpm run build # Uses Next.js build with relaxed linting
```

### Desktop App

```bash
cd apps/desktop
pnpm run tauri build # Uses Cargo + Vite (strict TS)
```

### Mobile App

```bash
cd apps/mobile
pnpm run build # Uses Vite (relaxed TS)
pnpm cap sync # Sync to native platforms
```

---

## Best Practices

1. **Shared Packages**: Keep strict mode enabled for type safety
2. **Apps**: Relax as needed for rapid development, but document why
3. **Inline Suppressions**: Always add comments explaining why
4. **Build Warnings**: Don't ignore in CI/CD unless absolutely necessary

---

## Quick Search

Find all suppressions:

```bash
# Find inline ESLint suppressions
git grep "eslint-disable"

# Find TypeScript ignores
git grep "@ts-ignore"

# Find strict mode settings
git grep "\"strict\":"
```

---

**Last Updated**: October 28, 2025
