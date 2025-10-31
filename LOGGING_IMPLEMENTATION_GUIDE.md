# Logging Implementation Quick Reference

> **Companion to LOGGING_MIGRATION_CHECKLIST.md**

## Using the Logger

### Basic Usage

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

### Compile-Time Guards (Performance Critical Paths)

For hot code paths, gate logs with compile-time flags to eliminate overhead when disabled:

```typescript
// In a high-frequency loop (e.g., stroke rendering)
if (__LOG_INK__) {
  logger.debug("ink", "Stroke point processed", { x, y, pressure });
}
```

Define flags in `vite.config.ts`:

```typescript
define: {
  __LOG_DB_LOCAL__: JSON.stringify(true),
  __LOG_INK__: JSON.stringify(process.env.NODE_ENV === "development"),
  // ... other domains
}
```

---

## Migration Patterns

### Pattern 1: Simple console.log → logger

**Before:**

```typescript
console.log("Syncing annotations to Dexie:", annotations.length);
```

**After:**

```typescript
logger.info("sync.electric", "Syncing annotations to Dexie", {
  count: annotations.length,
});
```

### Pattern 2: console.error with Error object

**Before:**

```typescript
console.error("Failed to fetch blob:", error);
```

**After:**

```typescript
logger.error("cas", "Failed to fetch blob", {
  sha256,
  error: error.message,
  stack: error.stack,
});
```

### Pattern 3: Debug logs (only in dev)

**Before:**

```typescript
if (process.env.NODE_ENV === "development") {
  console.log("WriteBuffer enqueued:", operation);
}
```

**After:**

```typescript
logger.debug("sync.writeBuffer", "Operation enqueued", {
  table: operation.table,
  op: operation.operation,
  id: operation.id,
});
```

### Pattern 4: Performance measurements

**Before:**

```typescript
const start = performance.now();
await syncToDexie(data);
console.log("Sync took", performance.now() - start, "ms");
```

**After:**

```typescript
const start = performance.now();
await syncToDexie(data);
logger.info("sync.electric", "Sync completed", {
  durationMs: Math.round(performance.now() - start),
  rowCount: data.length,
});
```

---

## Domain-Specific Examples

### db.local (Dexie Operations)

```typescript
// Transaction start
logger.debug("db.local", "Transaction started", {
  tables: ["works", "assets"],
});

// Bulk write
logger.info("db.local", "Bulk write completed", {
  table: "annotations",
  inserted: 50,
  updated: 10,
  durationMs: 25,
});

// Migration
logger.info("db.local", "Migration applied", {
  version: 5,
  name: "add_boards_table",
});
```

### sync.writeBuffer

```typescript
// Enqueue
logger.debug("sync.writeBuffer", "Operation enqueued", {
  table: "cards",
  op: "update",
  id: cardId,
});

// Flush
logger.info("sync.writeBuffer", "Flush started", { queueDepth: 42 });
logger.info("sync.writeBuffer", "Flush completed", {
  sent: 42,
  durationMs: 150,
});

// Retry
logger.warn("sync.writeBuffer", "Flush retry", {
  attempt: 2,
  backoffMs: 2000,
});

// Conflict
logger.warn("sync.writeBuffer", "LWW conflict resolved", {
  table: "annotations",
  id: annotationId,
  keptVersion: "client",
});
```

### sync.electric

```typescript
// Shape subscription
logger.info("sync.electric", "Shape subscribed", {
  table: "works",
  url: shapeUrl,
});

// Data received
logger.info("sync.electric", "Shape data received", {
  table: "annotations",
  rows: data.length,
  isFreshData: true,
});

// Sync to Dexie
logger.info("sync.electric", "Synced to Dexie", {
  table: "blobs_meta",
  rows: 150,
  durationMs: 35,
});

// Error
logger.error("sync.electric", "Shape subscription failed", {
  table: "cards",
  error: error.message,
});
```

### cas

```typescript
// Put
logger.info("cas", "Blob stored", {
  sha256,
  size: blob.size,
  mime: blob.mime,
  durationMs: 120,
});

// Get
logger.debug("cas", "Blob retrieved", { sha256, cached: true });

// Delete
logger.info("cas", "Blob deleted", { sha256 });

// List
logger.debug("cas", "Blob listing", { count: 42, filterOrphaned: true });
```

### blob.upload / blob.download

```typescript
// Upload start
logger.info("blob.upload", "Upload started", {
  filename: file.name,
  size: file.size,
});

// Upload progress
logger.debug("blob.upload", "Upload progress", {
  filename,
  loaded: e.loaded,
  total: e.total,
});

// Upload complete
logger.info("blob.upload", "Upload complete", {
  filename,
  sha256,
  durationMs: 2500,
});

// Download stream
logger.info("blob.download", "Stream started", { sha256 });
logger.info("blob.download", "Stream complete", { sha256, bytesRead: 1024000 });
```

### server.api

```typescript
// Request start (with trace ID for correlation)
const traceId = nanoid();
logger.info("server.api", "Request received", {
  method: "POST",
  path: "/api/writes/batch",
  traceId,
});

// Response
logger.info("server.api", "Response sent", {
  traceId,
  status: 200,
  durationMs: 45,
});

// Error
logger.error("server.api", "Request failed", {
  traceId,
  status: 500,
  error: error.message,
});
```

### pdf

```typescript
// Document load
logger.info("pdf", "Document loaded", {
  sha256,
  pages: pdf.numPages,
  fileSize: 1024000,
});

// Page render
logger.debug("pdf", "Page rendered", {
  page: 5,
  scale: 1.5,
  durationMs: 120,
});

// Text extraction
logger.info("pdf", "Text extracted", {
  page: 1,
  chars: 2500,
  durationMs: 35,
});
```

### ink

```typescript
// Stroke start
logger.debug("ink", "Stroke started", {
  toolType: "pen",
  color: "#000000",
});

// Stroke processing
if (__LOG_INK__) {
  logger.debug("ink", "Point added", { x, y, pressure, timestamp });
}

// Stroke complete
logger.info("ink", "Stroke completed", {
  points: 150,
  durationMs: 450,
  simplified: true,
});

// Smoothing
logger.debug("ink", "Stroke smoothed", {
  originalPoints: 150,
  smoothedPoints: 75,
});
```

### whiteboard

```typescript
// Scene init
logger.info("whiteboard", "Scene initialized", {
  boardId,
  itemCount: 42,
});

// Eraser
logger.info("whiteboard", "Eraser hit detection", {
  itemsRemoved: 3,
  durationMs: 8,
});

// Undo/redo
logger.info("whiteboard", "Undo executed", {
  operation: "delete",
  itemsRestored: 5,
});

// State persistence
logger.info("whiteboard", "State saved", {
  boardId,
  items: 42,
  strokes: 150,
});
```

### srs

```typescript
// Session start
logger.info("srs", "Session started", {
  deckId,
  cardsTotal: 20,
  cardsDue: 15,
});

// Review
logger.info("srs", "Card reviewed", {
  cardId,
  rating: 4,
  newInterval: 7,
  algorithm: "FSRS",
});

// Algorithm calculation
logger.debug("srs", "Interval calculated", {
  cardId,
  prevInterval: 3,
  newInterval: 7,
  stability: 5.2,
  difficulty: 6.1,
});

// Session complete
logger.info("srs", "Session completed", {
  deckId,
  cardsReviewed: 15,
  avgRating: 3.4,
  durationMs: 300000,
});
```

### network

```typescript
// Fetch start
logger.debug("network", "Fetch started", {
  url,
  method: "POST",
});

// Fetch complete
logger.debug("network", "Fetch completed", {
  url,
  status: 200,
  durationMs: 120,
});

// Retry
logger.warn("network", "Fetch retry", {
  url,
  attempt: 2,
  error: "ETIMEDOUT",
});

// Network error
logger.error("network", "Fetch failed", {
  url,
  attempts: 3,
  error: error.message,
});
```

### ui

```typescript
// Error boundary
logger.error("ui", "Error boundary caught", {
  component: "PDFViewer",
  error: error.message,
  stack: error.stack,
});

// User interaction
logger.debug("ui", "Button clicked", {
  button: "save",
  page: "/library",
});

// Loading state
logger.warn("ui", "Long loading time", {
  component: "WorksList",
  durationMs: 2500,
});

// Performance warning
logger.warn("ui", "Slow render detected", {
  component: "InkCanvas",
  renderMs: 50,
  threshold: 16,
});
```

---

## Testing & Verification

### Check logs in dev console

```typescript
// All logs appear in browser console (dev mode)
// Format: [domain] message {data}
```

### Export logs

```typescript
// From log viewer UI:
// 1. Go to /admin/logs
// 2. Filter as needed
// 3. Click "Export JSONL" or "Export JSON"
```

### Programmatic access

```typescript
import { getRingBuffer } from "@/telemetry";

// Get all logs
const logs = getRingBuffer().dump();

// Filter
const errors = logs.filter((l) => l.level === "error");
const dbLogs = logs.filter((l) => l.domain === "db.local");

// Clear
getRingBuffer().clear();
```

---

## OTLP Production Setup

### Enable OTLP sink (opt-in)

```bash
# .env.production
NEXT_PUBLIC_ENABLE_OTLP=true
NEXT_PUBLIC_OTLP_ENDPOINT=https://opentelemetry-collector-contrib-production-700b.up.railway.app/v1/logs
```

### Resource labels

```typescript
// apps/web/src/telemetry.ts
makeOtlpHttpSink(undefined, {
  app: "deeprecall",
  platform: "web",
  env: "production",
  version: "1.0.0",
  deviceId: getDeviceId(), // Optional: track per-device
});
```

---

## Authentication Integration (Future)

> **Status**: Blocked until OAuth/NextAuth is implemented

When authentication is added, logs will include privacy-safe user identifiers:

### User Context (attached to OTLP resource)

```typescript
import { getTelemetryUserContext } from "@deeprecall/telemetry";

// After user logs in:
const userContext = getTelemetryUserContext();
// {
//   actorUid: "uD1...base64...",    // Pseudonymous (HMAC)
//   sessionId: "2a1c7f2e-...",       // UUID per session
//   deviceId: "...",                  // Already tracked
//   provider: "google"                // OAuth provider
// }

// Update OTLP sink with user context
makeOtlpHttpSink(endpoint, {
  app: "deeprecall",
  platform: "web",
  env: "prod",
  ...userContext, // Spread user identifiers
});
```

### API Correlation Headers

```typescript
import { getTelemetryHeaders } from "@deeprecall/telemetry";

// Wrap fetch to auto-add correlation headers
async function apiFetch(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...getTelemetryHeaders(), // X-DR-Actor, X-DR-Session, X-DR-Device
    },
  });
}

// Server-side (API routes)
const actorUid = req.headers.get("X-DR-Actor");
const sessionId = req.headers.get("X-DR-Session");

logger.info("server.api", "User action", {
  actorUid, // Correlate client/server logs
  sessionId,
  action: "batch_write",
});
```

### Querying by User in Grafana

```logql
# Find all logs for a specific user
{app="deeprecall", env="prod"}
| json
| actor_uid = "uD1...base64..."

# Find all logs for a session
{app="deeprecall", env="prod"}
| json
| session_id = "2a1c7f2e-..."
```

### Privacy Guarantees

- ✅ **No PII**: Never log emails, names, or raw OAuth IDs
- ✅ **Pseudonymous**: actor_uid is HMAC-derived (unguessable)
- ✅ **Revocable**: Rotate HMAC secret to invalidate old IDs
- ✅ **Short retention**: 7-14 days (GDPR compliant)

See `GUIDE_LOGGING.md` Section 7 for full implementation details.

---

## Best Practices

1. **Use appropriate levels:**
   - `debug`: Detailed diagnostics (hot paths gated by flags)
   - `info`: Normal operations (transactions, syncs, uploads)
   - `warn`: Recoverable issues (retries, conflicts, performance)
   - `error`: Failures (exceptions, network errors, crashes)

2. **Include context:**
   - Always include IDs (sha256, cardId, workId)
   - Include durations for async operations
   - Include counts for batch operations

3. **Performance:**
   - Use compile-time guards for high-frequency logs
   - Keep data objects small (<1KB)
   - Don't log sensitive data (passwords, tokens, emails, names)

4. **Consistency:**
   - Use same terminology across domains
   - Follow patterns in this guide
   - Include units (ms, bytes, rows)

5. **Privacy (when auth is added):**
   - Only log pseudonymous actor_uid (never raw user IDs)
   - Never log PII in data fields
   - Use correlation headers for server/client matching
   - Keep log retention short (7-14 days)
