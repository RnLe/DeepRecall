# Console Logging Control Guide

## Quick Reference

All console logging is now centrally controlled via environment variables in `apps/web/.env.local`.

## Configuration Options

### 1. Completely Disable Console Logs

```bash
# apps/web/.env.local
NEXT_PUBLIC_ENABLE_CONSOLE_LOGS=false
```

**Result:** Browser console stays clean, all logs still available at `/admin/logs`

### 2. Control Log Level (Filter by Severity)

```bash
# Show only important logs (recommended for development)
NEXT_PUBLIC_CONSOLE_LOG_LEVEL=info

# Show everything (use when debugging)
NEXT_PUBLIC_CONSOLE_LOG_LEVEL=debug

# Show only warnings and errors
NEXT_PUBLIC_CONSOLE_LOG_LEVEL=warn

# Show only errors
NEXT_PUBLIC_CONSOLE_LOG_LEVEL=error
```

**Result:** Controls minimum level displayed in console

### 3. Control Verbosity (Data Display)

```bash
# Compact mode - show field count only (recommended)
NEXT_PUBLIC_CONSOLE_VERBOSE=false
# Output: [domain] message (5 fields)

# Verbose mode - show full data objects
NEXT_PUBLIC_CONSOLE_VERBOSE=true
# Output: [domain] message { key1: value1, key2: value2, ... }
```

### 4. Filter by Domain (Advanced)

Edit `apps/web/src/telemetry.ts` to exclude specific noisy domains:

```typescript
makeConsoleSink({
  minLevel: consoleLevel,
  excludeDomains: [
    "sync.electric", // Hide Electric shape updates
    "sync.writeBuffer", // Hide write buffer operations
    "db.local", // Hide local database operations
  ],
  verbose: consoleVerbose,
});
```

## Recommended Configurations

### Development (Default)

```bash
NEXT_PUBLIC_ENABLE_CONSOLE_LOGS=true
NEXT_PUBLIC_CONSOLE_LOG_LEVEL=warn
NEXT_PUBLIC_CONSOLE_VERBOSE=false
```

**Best for:** Normal development work. Clean console showing only warnings/errors.

### Active Development

```bash
NEXT_PUBLIC_ENABLE_CONSOLE_LOGS=true
NEXT_PUBLIC_CONSOLE_LOG_LEVEL=info
NEXT_PUBLIC_CONSOLE_VERBOSE=false
```

**Best for:** When actively working on features. See important operations.

### Debugging

```bash
NEXT_PUBLIC_ENABLE_CONSOLE_LOGS=true
NEXT_PUBLIC_CONSOLE_LOG_LEVEL=debug
NEXT_PUBLIC_CONSOLE_VERBOSE=true
```

**Best for:** Investigating specific issues. See everything with full data.

### Silent

```bash
NEXT_PUBLIC_ENABLE_CONSOLE_LOGS=false
```

**Best for:** When you want a completely clean console. All logs still available at `/admin/logs`.

### Production-Like

```bash
NEXT_PUBLIC_ENABLE_CONSOLE_LOGS=true
NEXT_PUBLIC_CONSOLE_LOG_LEVEL=error
NEXT_PUBLIC_CONSOLE_VERBOSE=false
```

**Best for:** Testing production behavior. Only see errors in console.

## Log Levels Explained

| Level   | Priority | When to Use                                          | Console Default |
| ------- | -------- | ---------------------------------------------------- | --------------- |
| `debug` | Lowest   | Detailed diagnostics, hot path logs (high frequency) | No              |
| `info`  | Normal   | Important operations (transactions, syncs, uploads)  | No              |
| `warn`  | Elevated | Recoverable issues (retries, conflicts, performance) | **Yes** ⭐      |
| `error` | Highest  | Failures (exceptions, network errors, crashes)       | Yes             |

**Note:** With `minLevel=warn` (default), you only see warnings and errors in the console. All logs (including debug/info) are always captured in the ring buffer and available at `/admin/logs`.

## Example Outputs

### Compact Mode (verbose=false)

```
[db.local] Transaction committed (3 fields)
[sync.electric] Shape data received (2 fields)
[blob.upload] Upload complete (4 fields)
```

### Verbose Mode (verbose=true)

```
[db.local] Transaction committed { writes: 5, durationMs: 12, table: "works" }
[sync.electric] Shape data received { rows: 150, bytes: 45000 }
[blob.upload] Upload complete { sha256: "abc...", size: 1024000, durationMs: 2500, filename: "doc.pdf" }
```

## Migration Impact

**Old behavior:** All console.log/warn/error calls went to console (noisy)

**New behavior:**

- ✅ All logs captured in telemetry system
- ✅ Console output filtered by level/domain
- ✅ Compact display by default
- ✅ Full logs always available at `/admin/logs`
- ✅ Centrally controlled via env vars (no code changes needed)

## Need to See Everything?

If you need to see all logs temporarily:

1. **In Browser Console:**

   ```javascript
   // Access the ring buffer directly
   window.__telemetry_dump = () => getRingBuffer().dump();

   // Then call it:
   __telemetry_dump();
   ```

2. **In Log Viewer UI:**
   - Go to `http://localhost:3000/admin/logs`
   - Use filters to find what you need
   - Export to JSONL/JSON if needed

## After Restart

Remember to **restart the dev server** after changing `.env.local`:

```bash
# Stop server (Ctrl+C)
cd apps/web && pnpm dev
```

Environment variables are only loaded on startup!
