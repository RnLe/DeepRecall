# Console Logger (Temporary Debug Tool)

## Overview

A lightweight in-app console log viewer for debugging connectivity issues across all platforms (Web, Desktop, Mobile). This is a **temporary solution** for development and will be removed once proper telemetry is implemented.

## Features

- ✅ Captures `console.log`, `console.warn`, `console.error`, `console.info`
- ✅ Real-time log updates (no refresh needed)
- ✅ Filter by log level (All / Log / Warn / Error)
- ✅ Search logs by text
- ✅ Auto-scroll to latest logs
- ✅ Badge showing error/warning count
- ✅ Export logs to file or copy to clipboard
- ✅ Clear logs button
- ✅ Shows last 500 logs (oldest auto-removed)

## Usage

### Accessing the Log Viewer

1. **All Platforms**: Click the "📋 Logs" button in the header (next to indicators)
   - **Web**: Top navigation bar (Railway deployment or localhost:3000)
   - **Desktop**: Tauri app navigation bar
   - **Mobile**: iOS app header
2. **Badge**: Red badge shows error count (or warning count if no errors)
3. **Dialog**: Centered modal overlay with all captured console output

### Debugging Workflow

```
1. Open app (Web/Desktop/Mobile)
2. Click "📋 Logs" button in header
3. See all console output (Electric connection, API calls, etc.)
4. Filter by level (Error/Warn) to focus on issues
5. Search for specific keywords (e.g., "Electric", "Railway")
6. Export or copy logs for sharing/analysis
```

### Log Filters

- **All**: Show all logs
- **Log**: Only `console.log()` messages
- **Warn**: Only `console.warn()` messages
- **Error**: Only `console.error()` messages

### Export Options

- **📋 Copy**: Copy all logs to clipboard (plain text)
- **💾 Export**: Download logs as `.txt` file
- **🗑️ Clear**: Clear all captured logs

## What Gets Logged

The logger captures all console output including:

- **Electric sync**: Connection status, shape updates, errors
- **API calls**: HTTP requests to Railway backend
- **Write buffer**: Flush operations, batch API calls
- **CAS operations**: Blob storage reads/writes
- **React errors**: Component errors, hooks warnings
- **General app**: Any `console.log/warn/error` in your code

## Files Involved

### Core Logger

- `packages/data/src/utils/consoleLogger.ts` - Console intercept logic

### UI Component

- `packages/ui/src/admin/LogViewer.tsx` - Log viewer dialog + button

### Integration

**Platform Initialization:**

- `apps/web/app/providers.tsx` - Web logger initialization
- `apps/desktop/src/main.tsx` - Desktop logger initialization
- `apps/mobile/src/main.tsx` - Mobile logger initialization

**UI Integration:**

- `apps/web/app/layout.tsx` - Web button in header
- `apps/desktop/src/components/Layout.tsx` - Desktop button in header
- `apps/mobile/src/components/Layout.tsx` - Mobile button in header

**Package Exports:**

- `packages/ui/src/index.ts` - Export log viewer components
- `packages/data/src/utils/index.ts` - Export logger utility

## How It Works

1. **Intercept**: Wraps `console.log/warn/error/info` methods
2. **Capture**: Stores each log with timestamp, level, and message
3. **Original**: Still calls original console method (visible in browser/native DevTools)
4. **Notify**: Updates React components via subscription pattern
5. **Limit**: Keeps last 500 logs in memory (auto-removes oldest)

## Debugging Railway/Electric Issues

### Check Electric Connection

1. Open log viewer
2. Search for "Electric"
3. Look for:
   - `[Electric] Initialized with URL: ...` (connection started)
   - `[Electric] Shape updated: ...` (data syncing)
   - `[Electric] Shape error: ...` (connection failed)

### Check Railway API Connection

1. Open log viewer
2. Search for "API" or "batch"
3. Look for:
   - `POST /api/writes/batch` (write buffer flush)
   - HTTP status codes (200 = success, 4xx/5xx = error)
   - CORS errors (if Railway URL is wrong)

### Common Issues to Look For

- **"Electric not initialized"**: Missing environment variables
- **"Failed to fetch"**: Wrong `VITE_API_BASE_URL` or network issue
- **"NetworkError"**: Railway server down or CORS misconfigured
- **"Shape error 409"**: Database cleared while shape active (expected)

## Removal Instructions

When you implement proper telemetry, remove this temporary logger:

### 1. Remove Logger Files

```bash
rm packages/data/src/utils/consoleLogger.ts
rm packages/ui/src/admin/LogViewer.tsx
```

### 2. Update Exports

```typescript
// packages/data/src/utils/index.ts
// Remove: export * from "./consoleLogger";

// packages/ui/src/index.ts
// Remove: export { LogViewerButton, LogViewerDialog } from "./admin/LogViewer";
```

### 3. Remove Initialization (All Platforms)

```typescript
// apps/web/app/providers.tsx
// Remove: initConsoleLogger();
// Remove: console.log("[Web] Console logger initialized");

// apps/desktop/src/main.tsx
// Remove: import { initConsoleLogger } from "@deeprecall/data";
// Remove: initConsoleLogger();
// Remove: console.log("[Desktop] Console logger initialized");

// apps/mobile/src/main.tsx
// Remove: import { initConsoleLogger } from "@deeprecall/data";
// Remove: initConsoleLogger();
// Remove: console.log("[Mobile] Console logger initialized");
```

### 4. Remove Button from Layout (All Platforms)

```typescript
// apps/web/app/layout.tsx
// Remove: import { LogViewerButton } from "@deeprecall/ui";
// Remove: <LogViewerButton /> from header

// apps/desktop/src/components/Layout.tsx
// Remove: import { LogViewerButton } from "@deeprecall/ui";
// Remove: <LogViewerButton /> from header

// apps/mobile/src/components/Layout.tsx
// Remove: import { LogViewerButton } from "@deeprecall/ui";
// Remove: <LogViewerButton /> from header
```

### 5. Clean Build (All Platforms)

```bash
# Web
cd apps/web
pnpm run build

# Desktop
cd apps/desktop
pnpm run build

# Mobile
cd apps/mobile
pnpm run build:ios
npx cap sync ios
```

## Performance Impact

- **Minimal**: Only stores last 500 logs in memory (~50KB)
- **No network**: All client-side, no telemetry servers
- **Reversible**: Easy to remove, no database changes

## Limitations

- **In-memory only**: Logs lost on app restart
- **500 log limit**: Older logs auto-deleted
- **No persistence**: Can't view logs after closing app
- **No remote access**: Must use device to view logs

For production telemetry, consider:

- Sentry (error tracking)
- LogRocket (session replay)
- Custom backend logging
- Native crash reporters

## Notes

- This is **NOT production-ready telemetry**
- Meant for **temporary debugging** during development
- Does **NOT send logs anywhere** (100% client-side)
- Should be **removed before production release**

---

**Last Updated**: October 30, 2025  
**Status**: Temporary debugging tool (remove after connectivity issues resolved)
