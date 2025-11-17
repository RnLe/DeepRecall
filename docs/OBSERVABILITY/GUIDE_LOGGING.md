# Logging System Guide

> **Structured logging with local ring buffer, optional console output, and OTLP export to Grafana/Loki**

## Overview

DeepRecall uses a custom structured logging system built on `@deeprecall/telemetry`:

- **All platforms**: Logs stored in local ring buffer (4000 events, circular)
- **Development**: Optional filtered console output (controlled by env vars)
- **Production**: Silent by default, OTLP export opt-in
- **Log viewer**: `/admin/logs` page on all platforms (web, desktop, mobile)

**Key benefit**: Logs are always captured and exportable, even without server connectivity.

---

## Quick Start

### 1. Import and Use

```typescript
import { logger } from "@deeprecall/telemetry";

// Info level (general operations)
logger.info("db.local", "Transaction committed", { writes: 5, durationMs: 12 });

// Debug level (detailed diagnostics)
logger.debug("sync.electric", "Shape data received", {
  rows: 150,
  bytes: 45000,
});

// Warning level (recoverable issues)
logger.warn("network", "Request retry", { attempt: 2, maxRetries: 5 });

// Error level (failures)
logger.error("server.api", "Database query failed", {
  error: error.message,
  query: "SELECT * FROM works",
});
```

### 2. View Logs

- **Web**: Navigate to `http://localhost:3000/admin/logs`
- **Desktop**: Navigate to `/admin/logs` in app
- **Mobile**: Navigate to `/admin/logs` in app

Features: Filter by level/domain, search, export to JSONL/JSON, auto-refresh

---

## Domains

Logs are categorized by domain for filtering and analysis:

| Domain              | Description                                     |
| ------------------- | ----------------------------------------------- |
| `db.local`          | Dexie operations (transactions, reads, writes)  |
| `db.postgres`       | PostgreSQL operations (server-side)             |
| `sync.writeBuffer`  | Write buffer operations (enqueue, flush, retry) |
| `sync.electric`     | Electric shape subscriptions and sync           |
| `sync.coordination` | Blob coordination between Postgres and CAS      |
| `cas`               | Content-addressed storage operations            |
| `blob.upload`       | Blob upload operations                          |
| `blob.download`     | Blob download operations                        |
| `blob.bridge`       | Blob bridging between platforms                 |
| `server.api`        | Server-side API handlers                        |
| `pdf`               | PDF rendering and annotation                    |
| `ink`               | Inking/drawing operations                       |
| `whiteboard`        | Whiteboard scene management                     |
| `srs`               | Spaced repetition system                        |
| `auth`              | Authentication operations                       |
| `network`           | Network requests and retries                    |
| `ui`                | UI interactions and errors                      |
| `console`           | Captured `console.log/warn/error` output        |

---

## Log Levels

| Level   | Priority | When to Use                                          |
| ------- | -------- | ---------------------------------------------------- |
| `debug` | Lowest   | Detailed diagnostics, hot path logs (high frequency) |
| `info`  | Normal   | Important operations (transactions, syncs, uploads)  |
| `warn`  | Elevated | Recoverable issues (retries, conflicts, performance) |
| `error` | Highest  | Failures (exceptions, network errors, crashes)       |

**Console filtering**: Set minimum level to reduce noise (see Environment Variables below)

---

## Environment Variables

### Web (Next.js)

```bash
# apps/web/.env.local

# Console output (development only)
NEXT_PUBLIC_ENABLE_CONSOLE_LOGS=true    # Toggle console output
NEXT_PUBLIC_CONSOLE_LOG_LEVEL=warn      # Minimum level: debug|info|warn|error
NEXT_PUBLIC_CONSOLE_VERBOSE=false       # Compact (default) or verbose data
NEXT_PUBLIC_CAPTURE_CONSOLE_LOGS=true   # Mirror browser console into telemetry log viewer

# OTLP export (optional, production)
NEXT_PUBLIC_ENABLE_OTLP=true            # Enable OTLP export
NEXT_PUBLIC_OTLP_ENDPOINT=https://opentelemetry-collector-contrib-production-700b.up.railway.app/v1/logs
```

### Desktop/Mobile (Vite)

```bash
# apps/desktop/.env.local or apps/mobile/.env.local

# Console output (development only)
VITE_ENABLE_CONSOLE_LOGS=true           # Toggle console output
VITE_CONSOLE_LOG_LEVEL=warn             # Minimum level: debug|info|warn|error
VITE_CONSOLE_VERBOSE=false              # Compact (default) or verbose data
VITE_CAPTURE_CONSOLE_LOGS=true          # Mirror native console into telemetry log viewer

# OTLP export (optional, production)
VITE_ENABLE_OTLP=true                   # Enable OTLP export
VITE_OTLP_ENDPOINT=https://opentelemetry-collector-contrib-production-700b.up.railway.app/v1/logs
```

### Recommended Configurations

**Development (default)**:

```bash
ENABLE_CONSOLE_LOGS=true
CONSOLE_LOG_LEVEL=warn
CONSOLE_VERBOSE=false
CAPTURE_CONSOLE_LOGS=true
```

Clean console showing only warnings/errors.

**Debugging**:

```bash
ENABLE_CONSOLE_LOGS=true
CONSOLE_LOG_LEVEL=debug
CONSOLE_VERBOSE=true
CAPTURE_CONSOLE_LOGS=true
```

See everything with full data objects.

**Silent**:

```bash
ENABLE_CONSOLE_LOGS=false
```

Completely clean console. All logs still available at `/admin/logs`.

---

## Console Output Formats

### Compact (verbose=false, default)

```
[db.local] Transaction committed (3 fields)
[sync.electric] Shape data received (2 fields)
[blob.upload] Upload complete (4 fields)
```

### Verbose (verbose=true)

```
[db.local] Transaction committed { writes: 5, durationMs: 12, table: "works" }
[sync.electric] Shape data received { rows: 150, bytes: 45000 }
[blob.upload] Upload complete { sha256: "abc...", size: 1024000, durationMs: 2500 }
```

**Note**: Console settings only affect browser/native console. All logs (including debug/info) are always captured in ring buffer and available at `/admin/logs`.

---

## Common Usage Patterns

### Pattern 1: Transaction Logging

```typescript
// db.local domain
logger.debug("db.local", "Transaction started", {
  tables: ["works", "assets"],
});

const result = await db.transaction("rw", [db.works, db.assets], async () => {
  // ... operations
});

logger.info("db.local", "Transaction committed", {
  writes: result.changes,
  durationMs: Math.round(performance.now() - start),
});
```

### Pattern 2: Network Operations

```typescript
// network domain
const start = performance.now();
logger.debug("network", "Fetch started", { url, method: "POST" });

try {
  const response = await fetch(url, { method: "POST", body });
  logger.debug("network", "Fetch completed", {
    url,
    status: response.status,
    durationMs: Math.round(performance.now() - start),
  });
} catch (error) {
  logger.error("network", "Fetch failed", {
    url,
    error: error.message,
    durationMs: Math.round(performance.now() - start),
  });
}
```

### Pattern 3: Error Handling

```typescript
// cas domain
try {
  const blob = await casGet(sha256);
  logger.debug("cas", "Blob retrieved", { sha256, cached: true });
} catch (error) {
  logger.error("cas", "Failed to fetch blob", {
    sha256,
    error: error.message,
    stack: error.stack,
  });
  throw error;
}
```

### Pattern 4: Write Buffer

```typescript
// sync.writeBuffer domain
logger.debug("sync.writeBuffer", "Operation enqueued", {
  table: "cards",
  operation: "upsert",
  id: cardId,
});

// Later, during flush
logger.info("sync.writeBuffer", "Flush started", { queueDepth: 42 });

const result = await flushToServer(batch);

logger.info("sync.writeBuffer", "Flush completed", {
  sent: batch.length,
  durationMs: Math.round(performance.now() - start),
});
```

---

## Telemetry Initialization

All three platforms use identical initialization pattern:

```typescript
// apps/{web,desktop,mobile}/src/telemetry.ts
import { registerSinks } from "@deeprecall/telemetry";
import {
  makeRingBufferSink,
  makeConsoleSink,
  makeOtlpHttpSink,
} from "@deeprecall/telemetry/sinks";

let ringBuffer: RingBufferSink | null = null;

export function initTelemetry() {
  if (ringBuffer) return; // Already initialized

  ringBuffer = makeRingBufferSink(4000);
  const sinks = [ringBuffer];

  // Dev: Add filtered console sink
  if (isDev && enableConsoleLogs) {
    sinks.push(
      makeConsoleSink({
        minLevel: consoleLevel,
        excludeDomains: [], // Optional: exclude noisy domains
        verbose: consoleVerbose,
      })
    );
  }

  // OTLP sink (optional)
  if (enableOtlp) {
    sinks.push(
      makeOtlpHttpSink(endpoint, {
        app: "deeprecall",
        platform: "web|desktop|mobile",
        env: "development|production",
      })
    );
  }

  registerSinks(...sinks);
}

export function getRingBuffer() {
  if (!ringBuffer) throw new Error("Telemetry not initialized");
  return ringBuffer;
}
```

**Platform differences**:

- **Web**: Uses `process.env.NEXT_PUBLIC_*` (Next.js)
- **Desktop/Mobile**: Uses `import.meta.env.VITE_*` (Vite)

---

## OTLP Production Setup (Optional)

### Architecture

```
DeepRecall Clients (Web/Desktop/Mobile)
  ↓ OTLP/HTTP
OpenTelemetry Collector (Railway)
  ↓ OTLP
Loki (Railway)
  ↑
Grafana (Railway) - Query & Dashboards
```

### Railway Services

**Current deployment**:

- **Grafana**: `https://grafana-production-aca8.up.railway.app`
- **OTLP Collector**: `https://opentelemetry-collector-contrib-production-700b.up.railway.app` (port 4318)
- **Loki**: Internal Railway service (not directly exposed)

### Enable OTLP Export

1. Set environment variables (see above)
2. Restart app
3. Logs automatically batched and sent to collector (max 200 events per batch)
4. View in Grafana at `/explore` with Loki datasource

### OTLP Configuration

The OTLP sink automatically:

- Batches logs (up to 200 events)
- Sends via HTTP POST to collector `/v1/logs` endpoint
- Includes resource labels: `app`, `platform`, `env`
- Handles failures gracefully (logs to console in dev)
- Auto-flushes every 5 seconds

**Note**: OTLP is opt-in. By default, all logs stay local in ring buffer.

---

## Log Viewer UI

### Features

- **Filters**: By level (debug/info/warn/error), domain, time range
- **Search**: Full-text search across message and data fields
- **Stats**: Error/warning counts, domain distribution
- **Detail view**: Click any log to see full JSON data
- **Export**: Download as JSONL or JSON
- **Auto-refresh**: Real-time updates (optional)
- **Clear**: Clear all logs from ring buffer

### Implementation

```tsx
// All platforms: apps/{web,desktop,mobile}/app/admin/logs/page.tsx
import { TelemetryLogViewer } from "@deeprecall/ui/admin/TelemetryLogViewer";
import { getRingBuffer } from "@/src/telemetry";

export default function LogsPage() {
  return <TelemetryLogViewer getRingBuffer={getRingBuffer} />;
}
```

Component: `packages/ui/src/admin/TelemetryLogViewer.tsx`

---

## Advanced: Compile-Time Guards

For performance-critical hot paths (e.g., inking), use compile-time guards to eliminate overhead when logging is disabled:

```typescript
// Define in vite.config.ts or next.config.js
define: {
  __LOG_INK__: JSON.stringify(true),
  __LOG_DB_LOCAL__: JSON.stringify(true),
}

// Usage (dead code elimination when false)
if (__LOG_INK__) {
  logger.debug("ink", "Stroke point processed", { x, y, pressure });
}
```

When `__LOG_INK__` is `false`, minifiers completely remove the log call and data object construction.

---

## Performance Characteristics

- **Ring buffer**: Fixed 4000 events, circular (oldest auto-removed)
- **Console sink**: Minimal overhead (~0.1ms per log)
- **OTLP sink**: Batched, async (5s flush interval)
- **Memory**: ~50KB for 4000 logs in ring buffer

**Hot path recommendation**: Use compile-time guards for high-frequency logs (>100/sec)

---

## Migration Status

✅ **Phase 1 Complete**: Telemetry package created and integrated across all platforms  
✅ **Phase 2 Complete**: ~989 console calls migrated across 230+ files (100% coverage)  
✅ **Phase 3 Complete**: Modern log viewer UI with filters, stats, export

**Remaining**: Add systematic domain-specific logging to critical interfaces (Electric, WriteBuffer, CAS operations)

---

## Files

### Core Package

- `packages/telemetry/src/logger.ts` - Logger interface and types
- `packages/telemetry/src/sinks/ringBuffer.ts` - Ring buffer sink
- `packages/telemetry/src/sinks/console.ts` - Filtered console sink
- `packages/telemetry/src/sinks/otlpHttp.ts` - OTLP HTTP sink
- `packages/telemetry/src/index.ts` - Public API exports

### Platform Initialization

- `apps/web/src/telemetry.ts` - Web initialization (Next.js)
- `apps/desktop/src/telemetry.ts` - Desktop initialization (Tauri)
- `apps/mobile/src/telemetry.ts` - Mobile initialization (Capacitor)

### UI

- `packages/ui/src/admin/TelemetryLogViewer.tsx` - Log viewer component
- `apps/web/app/admin/logs/page.tsx` - Web log viewer page
- `apps/desktop/src/pages/admin/LogsPage.tsx` - Desktop log viewer page
- `apps/mobile/src/pages/admin/LogsPage.tsx` - Mobile log viewer page

---

## Troubleshooting

### Logs not appearing in console

1. Check `ENABLE_CONSOLE_LOGS` is `true`
2. Verify `CONSOLE_LOG_LEVEL` is low enough (try `debug`)
3. Check domain not in `excludeDomains` list
4. Restart dev server after changing `.env` files

### Logs not appearing in `/admin/logs`

1. Verify telemetry initialized: Check for "Telemetry initialized" log on app start
2. Check ring buffer: `getRingBuffer().dump()` in console
3. Clear and retry: Click "Clear Logs" button in UI

### OTLP export failing

1. Verify `ENABLE_OTLP=true` and `OTLP_ENDPOINT` set
2. Check network: OTLP endpoint must be HTTPS and CORS-enabled
3. Check browser console for OTLP sink errors
4. Verify OpenTelemetry Collector running on Railway

### Console too noisy

1. Increase `CONSOLE_LOG_LEVEL` to `warn` or `error`
2. Add noisy domains to `excludeDomains` in telemetry.ts
3. Set `CONSOLE_VERBOSE=false` for compact output
4. Disable console entirely: `ENABLE_CONSOLE_LOGS=false`

---

## Related Guides

- `GUIDE_DATA_ARCHITECTURE.md` - Data flow and sync patterns
- `GUIDE_ELECTRIC_PATTERN.md` - Electric sync implementation
- `GUIDE_PLATFORM_WRAPPERS.md` - Platform-specific patterns
