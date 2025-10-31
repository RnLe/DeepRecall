# Mental model

- **Client logger (DeepRecall app)** → ships **structured JSON** events.
- When telemetry is **off**, compile-time guards strip calls; runtime overhead ≈ zero.
- When **on**, events go to local **ring buffer** (for crash bundles/export) and—if you enable it—to your central pipeline.
- **Central pipeline (Railway):** OpenTelemetry **Collector** (intake) → **Loki** (log store) → **Grafana** (search & dashboards). Grafana is the UI; **Loki** is the scalable log database. ([Grafana Labs][2])

Loki is widely used, horizontally scalable and cost-efficient (label-indexed; compressed chunks). Grafana sits on top and is solid for logs now and traces/metrics later (Tempo/Prometheus). ([GitHub][3])

> Re scalability: each **client** logs locally and only ships if enabled. App-side performance is your guardrail; server-side scale is Loki's job.

## Privacy & User Tracking (GDPR-safe)

When authentication is added, logs can include **pseudonymous identifiers** for user/session/device correlation:

- **actor_uid**: HMAC-based pseudonymous user ID (stable, unguessable, revocable)
- **session_id**: UUID per login session (short-lived)
- **device_id**: UUID stored client-side (persistent across sessions)

**Critical**: These are **NOT Loki labels** (would explode cardinality). They're log event **attributes**, queryable via LogQL JSON parsing.

**Retention**: Keep logs short (7-14 days) for easy GDPR compliance. Never log emails, names, or raw OAuth IDs.

---

# Developer guide — Logging v1 (with a door open to “the rest”)

## 0) Repo layout (suggested)

```
packages/
  telemetry/                 # shared facade & types (TS)
    src/
      logger.ts
      sinks/
        ringBuffer.ts
        console.ts
        otlpHttp.ts         # POST → Collector (logs)
apps/
  web/                       # Next.js client & API
  desktop/                   # Tauri (Rust + TS UI)
  mobile/                    # Capacitor shell
infra/
  railway/README.md          # notes: service URLs, env, one-shot writers
```

---

## 1) Client logging facade (TypeScript)

Compile-time flags to erase code when off:

```ts
// packages/telemetry/src/logger.ts
export type Level = "debug" | "info" | "warn" | "error";
export type Domain =
  | "db.local"
  | "sync.writeBuffer"
  | "sync.electric"
  | "server.api"
  | "cas"
  | "pdf"
  | "ui";

export interface LogEvent {
  ts: number;
  level: Level;
  domain: Domain;
  msg: string;
  data?: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
}

export interface Sink {
  write: (e: LogEvent) => void;
  flush?: () => Promise<void>;
}

let sinks: Sink[] = [];

export function registerSinks(...s: Sink[]) {
  sinks = s;
}

export function log(e: LogEvent) {
  // Keep as cheap as possible: do not prebuild data if disabled.
  for (const s of sinks) s.write(e);
}

// Convenience helpers
export const logger = {
  debug(domain: Domain, msg: string, data?: object) {
    /*#__PURE__*/ log({ ts: Date.now(), level: "debug", domain, msg, data });
  },
  info(domain: Domain, msg: string, data?: object) {
    /*#__PURE__*/ log({ ts: Date.now(), level: "info", domain, msg, data });
  },
  warn(domain: Domain, msg: string, data?: object) {
    /*#__PURE__*/ log({ ts: Date.now(), level: "warn", domain, msg, data });
  },
  error(domain: Domain, msg: string, data?: object) {
    /*#__PURE__*/ log({ ts: Date.now(), level: "error", domain, msg, data });
  },
};
```

**Dead-strip guards:** define per-domain booleans in your bundler (esbuild/vite/webpack define):

```ts
declare const __LOG_DB_LOCAL__: boolean;

// usage
if (__LOG_DB_LOCAL__) {
  logger.info("db.local", "txn commit", { writes, durationMs });
}
```

When the define is `false`, minifiers drop the whole block.

**Sinks**

```ts
// ringBuffer.ts
export function makeRingBufferSink(
  capacity = 2000
): Sink & { dump: () => LogEvent[] } {
  const buf: LogEvent[] = new Array(capacity);
  let i = 0,
    filled = false;
  return {
    write(e) {
      buf[i] = e;
      i = (i + 1) % capacity;
      if (i === 0) filled = true;
    },
    dump() {
      return filled ? [...buf.slice(i), ...buf.slice(0, i)] : buf.slice(0, i);
    },
  };
}

// console.ts (dev only)
export const consoleSink: Sink = {
  write(e) {
    // cheap path
    // eslint-disable-next-line no-console
    console[e.level === "debug" ? "log" : e.level](
      `[${e.domain}] ${e.msg}`,
      e.data ?? {}
    );
  },
};
```

Optional **OTLP sink** later (to OTEL Collector). Loki supports OTLP logs over HTTP via the Collector’s exporter, so you can add this without touching callsites. ([Grafana Labs][4])

---

## 2) Replacing `console.log` safely

Add a tiny shim that **mirrors** to your logger (only in dev or when you explicitly turn it on):

```ts
export function hijackConsole(domain: Domain = "ui") {
  const orig = { ...console };
  console.log = (...args) => {
    orig.log(...args);
    logger.debug(domain, args[0]?.toString() ?? "log", { args });
  };
  console.warn = (...args) => {
    orig.warn(...args);
    logger.warn(domain, args[0]?.toString() ?? "warn", { args });
  };
  console.error = (...args) => {
    orig.error(...args);
    logger.error(domain, args[0]?.toString() ?? "error", { args });
  };
  return () => Object.assign(console, orig); // restore
}
```

Prefer **explicit** `logger.*` calls in hot paths. Use the hijack only to catch third-party noise during development.

---

## 3) Wire it into DeepRecall

- **Where to log:**
  - Dexie repo tx begin/end (`db.local`), write counts, durations.
  - WriteBuffer enqueue/flush (`sync.writeBuffer`), batch sizes, retries.
  - Electric shape subscribe/update (`sync.electric`) with row counts.
  - CAS put/get/list (`cas`) sizes and timings.
  - Next.js API handlers (`server.api`) with a correlation `traceId`.

- **Initialize sinks per build flavor:**
  - Dev: `registerSinks(makeRingBufferSink(), makeConsoleSink())`
  - Prod default: `registerSinks(makeRingBufferSink(4000))`
  - Prod w/ aggregation: add an OTLP sink to ship to your Collector (opt-in).

On **crash** (ErrorBoundary): include `ringBuffer.dump()` in the report you send to your crash backend (Sentry/GlitchTip self-host later).

### Console Output Control (Environment Variables)

Console logging is **centrally controlled** via environment variables—no need to modify log calls across your codebase:

```bash
# .env.local (Next.js apps)
NEXT_PUBLIC_ENABLE_CONSOLE_LOGS=true    # Toggle console output on/off
NEXT_PUBLIC_CONSOLE_LOG_LEVEL=warn      # Filter by level: debug|info|warn|error
NEXT_PUBLIC_CONSOLE_VERBOSE=false       # Compact format (default) or verbose
```

**Levels** (lowest to highest priority):

- `debug` → shows everything (noisy, for deep debugging)
- `info` → shows info/warn/error (moderate, good for development)
- `warn` → shows warn/error only (clean, **recommended default**)
- `error` → shows only errors (silent, production-like)

**Compact vs Verbose**:

- `verbose=false` (default): Shows `(N fields)` instead of full data objects
- `verbose=true`: Shows full JSON data for each log event

**Example** (`warn` level, compact):

```
[sync.electric] Shape update failed (3 fields)
[server.api] Database query error (5 fields)
```

**Key benefit**: All logs still flow to the ring buffer and `/admin/logs` UI regardless of console settings. Console filtering is purely for developer convenience during local development.

For advanced filtering (e.g., exclude specific domains), see `apps/web/src/telemetry.ts` which uses `makeConsoleSink()` with `excludeDomains` support.

---

## 4) Deploy the logging backend on **Railway** (no Docker on your machine)

We already have:

- **Grafana (UI)**: `https://grafana-production-aca8.up.railway.app`
- **OTel Collector (public)**: `https://opentelemetry-collector-contrib-production-700b.up.railway.app` (listens on 4318 via HTTPS)
- **Loki**: your Railway Loki service (public domain or `loki.railway.internal` for private networking)

### A) Loki (log database)

1. **Service**: `grafana/loki:latest`
2. **Volume**: mount at `/loki`
3. **One-shot config writer** (Alpine helper, same volume at `/loki`):
   - Env: `LOKI_CONFIG_B64=<base64-of-config.yaml>`
   - Start Command (single line):

     ```
     /bin/sh -c "mkdir -p /loki/chunks /loki/rules /loki/compactor /loki/tsdb-shipper-index /loki/tsdb-shipper-cache && printf %s \"\$LOKI_CONFIG_B64\" | base64 -d > /loki/config.yaml && chown -R 10001:10001 /loki && exit 0"
     ```

4. **Start Loki** (shell-free):

   ```
   /usr/bin/loki -config.file=/loki/config.yaml
   ```

5. **Config content** (what you base64-encoded):

   ```yaml
   analytics:
     reporting_enabled: false
   auth_enabled: false

   server:
     http_listen_port: 3100

   common:
     ring:
       instance_addr: 127.0.0.1
       kvstore:
         store: inmemory
     replication_factor: 1
     path_prefix: /loki

   schema_config:
     configs:
       - from: 2024-01-01
         store: tsdb
         object_store: filesystem
         schema: v13
         index:
           prefix: index_
           period: 24h

   storage_config:
     tsdb_shipper:
       active_index_directory: /loki/tsdb-shipper-index
       cache_location: /loki/tsdb-shipper-cache

   compactor:
     working_directory: /loki/compactor

   ruler:
     storage:
       type: local
       local:
         directory: /loki/rules
   ```

> Permissions: Loki runs as UID **10001**. The writer above `chown`s the volume so Loki can write.

### B) Grafana (UI)

1. **Service**: `grafana/grafana:latest`
2. **Volume**: mount at `/var/lib/grafana`
3. **Perms** (optional writer one-shot): `chown -R 472:472 /var/lib/grafana`
4. **Admin env** (first boot):
   `GF_SECURITY_ADMIN_USER=admin`
   `GF_SECURITY_ADMIN_PASSWORD=<strong>`
   (You can later reset via `grafana-cli` if needed.)
5. **Datasource (UI)** → Add **Loki**:
   - **URL** (public): `https://<your-loki-public-domain>` **(no :3100)**
   - or **URL** (private): `http://loki.railway.internal:3100`
   - **Access**: **Server (proxy)**
   - Save & Test

### C) OpenTelemetry Collector (intake)

1. **Service**: `otel/opentelemetry-collector-contrib:latest`

2. **Start Command**:

   ```
   /otelcol-contrib --config=env:OTEL_CONFIG
   ```

3. **Env `OTEL_CONFIG` (JSON)** — binds public, forwards to Loki’s OTLP:

   ```json
   {
     "receivers": {
       "otlp": { "protocols": { "http": { "endpoint": "0.0.0.0:4318" } } }
     },
     "processors": { "batch": {} },
     "exporters": {
       "otlphttp/loki": {
         "endpoint": "https://<your-loki-public-domain>/otlp"
       }
     },
     "service": {
       "pipelines": {
         "logs": {
           "receivers": ["otlp"],
           "processors": ["batch"],
           "exporters": ["otlphttp/loki"]
         }
       }
     }
   }
   ```

   _If you use the private URL:_ set `"endpoint": "http://loki.railway.internal:3100/otlp"`.

4. **Ports / Domains on Railway**
   - Grafana: **3000** (public) → `https://grafana-production-aca8.up.railway.app`
   - Loki: **3100** (public _or_ private)
   - OTel: **4318** (public) → `https://opentelemetry-collector-contrib-production-700b.up.railway.app`

---

## 5) Ship logs from the app (toggle when you want aggregation)

```ts
// packages/telemetry/src/sinks/otlpHttp.ts
export function makeOtlpHttpSink(
  endpoint = "https://opentelemetry-collector-contrib-production-700b.up.railway.app/v1/logs",
  resource: Record<string, string> = {}
): Sink {
  let queue: LogEvent[] = [];
  let inflight = false;

  async function flushBatch() {
    if (inflight || queue.length === 0) return;
    inflight = true;
    const batch = queue.splice(0, Math.min(queue.length, 200));
    const body = {
      resourceLogs: [
        {
          resource: {
            attributes: Object.entries(resource).map(([k, v]) => ({
              key: k,
              value: { stringValue: String(v) },
            })),
          },
          scopeLogs: [
            {
              logRecords: batch.map((e) => ({
                timeUnixNano: String(e.ts * 1e6),
                severityText: e.level.toUpperCase(),
                body: { stringValue: `${e.domain} | ${e.msg}` },
                attributes: Object.entries(e.data ?? {}).map(([k, v]) => ({
                  key: k,
                  value: {
                    stringValue: typeof v === "string" ? v : JSON.stringify(v),
                  },
                })),
              })),
            },
          ],
        },
      ],
    };
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify(body),
      });
    } finally {
      inflight = false;
    }
  }

  return {
    write(e) {
      queue.push(e);
      if (queue.length >= 50) void flushBatch();
    },
    async flush() {
      await flushBatch();
    },
  };
}
```

Enable it in prod with labels:

```ts
registerSinks(
  makeRingBufferSink(4000),
  makeOtlpHttpSink(undefined, {
    app: "deeprecall",
    platform: "web",
    env: "prod",
  })
);
```

---

## 6) A rich **in-app** log viewer (filters + export)

Build a tiny admin page so you can debug on a user’s device without server round-trips:

- **Source**: the ring buffer sink (`dump()`).
- **Filters**: by `level`, `domain`, time window, text search over `msg`/`data`.
- **Table**: virtualized list for 10k+ rows; click row → JSON drawer.
- **Export**: “Download JSONL” (write one event per line) or “Copy last 200 as JSON”.

Sketch:

```tsx
// apps/web/app/admin/logs.tsx
import { useMemo, useState } from "react";
import { ring } from "@deeprecall/telemetry/sinks/ringBuffer";

export default function LogsAdmin() {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<Level | "all">("all");
  const [domain, setDomain] = useState<Domain | "all">("all");

  const rows = useMemo(
    () =>
      ring
        .dump()
        .filter(
          (e) =>
            (level === "all" || e.level === level) &&
            (domain === "all" || e.domain === domain) &&
            (query === "" ||
              JSON.stringify(e).toLowerCase().includes(query.toLowerCase()))
        ),
    [query, level, domain]
  );

  const download = () => {
    const blob = new Blob(
      rows.map((r) => JSON.stringify(r) + "\n"),
      { type: "text/plain" } as any
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "deeprecall-logs.jsonl";
    a.click();
  };

  return (
    <div className="p-4 space-y-2">
      {/* controls … */}
      <button onClick={download}>Export JSONL</button>
      {/* render rows … */}
    </div>
  );
}
```

---

## 7) User/Session/Device Tracking (future: when auth is ready)

### Privacy-safe identifiers

When OAuth is implemented, attach these to every log event (as **attributes**, not labels):

1. **actor_uid** (pseudonymous user ID)
   - Derive: `base64url(HMAC_SHA256(SECRET, provider + ":" + subject))`
   - Inputs: OAuth `provider` (google/github) + `subject` (sub from token)
   - Stored: Server-side only, passed to client after login
   - Why HMAC? Stable, unguessable, revocable (rotate secret = can't correlate old logs)

2. **session_id** (UUID per login)
   - Generate: New UUID on each login/session
   - Stored: Memory + secure HTTP-only cookie
   - Lifetime: Until logout or token expiry

3. **device_id** (UUID per device)
   - Generate: UUID on first visit
   - Stored: localStorage/IndexedDB (already implemented in DeepRecall)
   - Lifetime: Persistent until user clears data

### Implementation (when auth added)

```ts
// After OAuth completes (NextAuth callback):
const actorUid = deriveActorUid(provider, token.sub); // server-side
const sessionId = crypto.randomUUID();

// Store in auth context/state
setAuthState({ actorUid, sessionId, deviceId: getDeviceId() });

// Update OTLP sink to include user context
makeOtlpHttpSink(endpoint, {
  app: "deeprecall",
  platform: "web",
  env: "prod",
  actor_uid: actorUid, // pseudonymous
  session_id: sessionId,
  device_id: deviceId,
  provider: provider, // low-cardinality (safe as label)
});
```

### Querying by user/session in Grafana (LogQL)

```logql
# By user (pseudonymous)
{app="deeprecall", env="prod"}
| json
| actor_uid = "uD1...base64..."

# By session
{app="deeprecall", env="prod"}
| json
| session_id = "2a1c7f2e-..."

# By device
{app="deeprecall", env="prod"}
| json
| device_id = "..."

# Pretty format
{app="deeprecall"}
| json
| line_format "{{.domain}} | {{.msg}} | {{.actor_uid}}"
```

### API server-side correlation

Pass identifiers via headers for server/client correlation:

```ts
// Client → API (fetch wrapper)
fetch("/api/writes/batch", {
  headers: {
    "X-DR-Actor": actorUid,
    "X-DR-Session": sessionId,
    "X-DR-Device": deviceId,
  },
});

// API route (Next.js)
const actorUid = req.headers.get("X-DR-Actor");
logger.info("server.api", "Batch write", {
  actorUid,
  sessionId,
  operations: batch.length,
});
```

### GDPR compliance

- ✅ **No PII**: Never log emails, names, or raw OAuth IDs
- ✅ **Short retention**: 7-14 days (configurable in Loki)
- ✅ **Revocable**: Rotate HMAC secret to invalidate old actor_uids
- ✅ **Right to be forgotten**: Short retention + log compaction handles deletion
- ✅ **Transparent**: User-facing privacy policy explains logging scope

For long-lived crash reports (>14 days), use dedicated crash backend with per-user erasure (Sentry/GlitchTip).

---

## 8) Tauri (Rust) note (when ready)

Use `tracing` with compile-time levels and JSON fmt. Later, you can forward to the Collector with `tracing-opentelemetry` (logs → OTLP) or write to a local file and let a mobile/desktop uploader send on demand. Grafana's stack plays fine with this because it all normalizes at OTLP/Loki. ([OpenTelemetry][5])

---

### Why this works

- Modular: Logger API is stable; sinks are pluggable. You can keep everything local (zero infra), or flip a switch to aggregate to Loki via the Collector—no code changes at call sites.
- Cost-free: All OSS (Grafana, Loki, Collector). Railway hosts each as a separate service.
- Future-proof: Same Collector lets you add **traces** (Tempo) and **metrics** later—Grafana remains your single pane. ([Grafana Labs][7])
