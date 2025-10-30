# Environment Variables Setup Guide

## Overview

This document explains all environment variables needed for production deployment and how data flows between components.

## Architecture Summary

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Mobile    │────────▶│   Railway Web    │────────▶│   Postgres  │
│     App     │         │    (Next.js)     │         │    (Neon)   │
└─────────────┘         └──────────────────┘         └─────────────┘
      │                                                       ▲
      │                                                       │
      └──────────────────▶ Electric Cloud ◀───────────────────┘
                          (Real-time Sync)
```

**Data Flow:**

1. **Reads (Real-time)**: Mobile ← Electric Cloud ← Postgres
2. **Writes (Optimistic)**: Mobile → Railway API (`/api/writes/batch`) → Postgres → Electric Cloud → Mobile

---

## 1. Mobile App Environment Variables

**Location:** GitHub Repository Secrets (not `.env` files!)

The mobile app gets its environment variables from **GitHub Actions** when building for TestFlight. These are injected at build time and bundled into the iOS app.

### Required GitHub Secrets

Go to: `https://github.com/RnLe/DeepRecall/settings/secrets/actions`

Add these secrets:

```bash
# Electric Cloud Configuration
VITE_ELECTRIC_URL=https://api.electric-sql.com/v1/shape
VITE_ELECTRIC_SOURCE_ID=7efa2a2d-20ad-472b-b2bd-4a6110c26d5c
VITE_ELECTRIC_SOURCE_SECRET=<your-electric-source-secret>

# Railway API URL (for write buffer flush)
VITE_API_BASE_URL=https://deeprecall-production.up.railway.app

# Blob Storage Mode
VITE_BLOB_STORAGE_MODE=native  # Use iOS filesystem (not Cloudflare R2)
```

### How Mobile App Uses These Variables

**1. Electric Sync (Real-time Reads)**

```typescript
// packages/data/src/electric.ts
const stream = new ShapeStream({
  url: import.meta.env.VITE_ELECTRIC_URL,
  params: {
    table: "works",
    source_id: import.meta.env.VITE_ELECTRIC_SOURCE_ID,
    source_secret: import.meta.env.VITE_ELECTRIC_SOURCE_SECRET,
  },
});
```

**2. Write Buffer (Optimistic Writes)**

```typescript
// apps/mobile/src/providers/index.tsx
const worker = initFlushWorker({
  apiBase: import.meta.env.VITE_API_BASE_URL, // Railway URL
  batchSize: 10,
  retryDelay: 1000,
  maxRetries: 5,
});

// Worker calls: https://deeprecall-production.up.railway.app/api/writes/batch
```

**3. Config Debugging**

```typescript
// apps/mobile/src/config/api.ts
import { getEnvironmentInfo } from "@/config/api";
console.log(getEnvironmentInfo());
// Shows: mode, apiBaseUrl, electricUrl, etc.
```

### Development vs Production

**Development (pnpm run dev:mobile):**

- Uses Vite proxy → localhost:3000
- Electric URL from `.env.development`
- Hot reload enabled

**Production (GitHub Actions → TestFlight):**

- Uses Railway URL from GitHub secrets
- Electric URL from GitHub secrets
- Bundled into iOS app binary

---

## 2. Railway Web App Environment Variables

**Location:** Railway Project Settings → Variables

Go to: `https://railway.app/project/<your-project-id>/settings`

### Required Railway Variables

```bash
# Postgres Database (automatically provided by Railway if you add Postgres service)
DATABASE_URL=postgresql://user:password@host:5432/database

# Electric Cloud Configuration (must match mobile app!)
NEXT_PUBLIC_ELECTRIC_URL=https://api.electric-sql.com/v1/shape
NEXT_PUBLIC_ELECTRIC_SOURCE_ID=7efa2a2d-20ad-472b-b2bd-4a6110c26d5c
NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET=<your-electric-source-secret>

# Optional: Base URL (Railway auto-generates this)
NEXT_PUBLIC_BASE_URL=https://deeprecall-production.up.railway.app

# Node Environment
NODE_ENV=production
```

### How Railway App Uses These Variables

**1. Write Buffer API Endpoint**

```typescript
// apps/web/app/api/writes/batch/route.ts
export async function POST(request: NextRequest) {
  const pool = getPostgresPool(); // Uses DATABASE_URL

  // Apply changes to Postgres
  const results = await applyChanges(client, changes);

  // Return applied IDs to client
  return NextResponse.json({ applied: results.map((r) => r.id) });
}
```

**2. Electric Sync (Real-time Reads)**

```typescript
// apps/web/app/providers.tsx
const stream = new ShapeStream({
  url: process.env.NEXT_PUBLIC_ELECTRIC_URL,
  params: {
    table: "works",
    source_id: process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_ID,
    source_secret: process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET,
  },
});
```

**3. Write Buffer Flush (Optimistic Writes)**

```typescript
// apps/web/app/providers.tsx
const worker = initFlushWorker({
  flushHandler: async (changes) => {
    // Calls same-origin: /api/writes/batch
    const response = await fetch("/api/writes/batch", {
      method: "POST",
      body: JSON.stringify({ changes }),
    });
    return await response.json();
  },
});
```

---

## 3. Electric Cloud Configuration

**Location:** Electric Cloud Console

Go to: `https://console.electric-sql.com/`

### What You Need

- **Source ID**: `7efa2a2d-20ad-472b-b2bd-4a6110c26d5c`
- **Source Secret**: `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...` (JWT token)
- **Database URL**: Your Neon Postgres connection string (Electric connects to your DB)

### Electric Setup

1. **Create Source** (already done)
   - Point Electric to your Neon Postgres instance
   - Electric reads changes via logical replication

2. **Sync Mode**
   - Use `"development"` mode (polling) NOT `"production"` (SSE)
   - SSE is unstable on Electric Cloud - polling works better

3. **Tables to Sync**
   - All tables in `public` schema
   - Electric automatically detects schema changes

---

## 4. How to Use Railway as API Gateway

### Mobile App → Railway API

**Yes, you simply call the API!**

```typescript
// Mobile app writes data
import { getApiBaseUrl } from '@/config/api';

const changes = [
  { op: "insert", table: "works", payload: {...} },
  { op: "update", table: "works", payload: {...} },
];

const response = await fetch(`${getApiBaseUrl()}/api/writes/batch`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ changes }),
});

const result = await response.json();
// result = { applied: ["id1", "id2"], errors: [] }
```

**Write Buffer does this automatically:**

```typescript
// apps/mobile/src/providers/index.tsx
const worker = initFlushWorker({
  apiBase: "https://deeprecall-production.up.railway.app",
});
worker.start(5000); // Flushes every 5 seconds

// Now just write locally, buffer handles sync:
await buffer.enqueue({
  op: "insert",
  table: "works",
  payload: { id: "123", title: "New Work" },
});
```

### Available Railway API Endpoints

```bash
# Write Buffer API (mobile/web → postgres)
POST /api/writes/batch
Body: { changes: WriteChange[] }
Response: { applied: string[], errors: Error[] }

# Health Checks
GET /api/health
GET /api/health/postgres
GET /api/health/electric

# Admin Tools
POST /api/admin/sync-blob         # Sync single blob to Electric
POST /api/admin/sync-to-electric  # Sync all blobs to Electric
GET  /api/admin/postgres/all      # Query all Postgres data

# Blob Storage (if using Cloudflare R2)
POST /api/blob/upload
GET  /api/blob/[blobId]
```

---

## 5. Verification Checklist

### Check GitHub Secrets

```bash
# List all secrets (values are hidden)
gh secret list --repo RnLe/DeepRecall

# Should show:
# VITE_ELECTRIC_URL
# VITE_ELECTRIC_SOURCE_ID
# VITE_ELECTRIC_SOURCE_SECRET
# VITE_API_BASE_URL
# ASC_KEY_ID (Apple credentials)
# ASC_ISSUER_ID
# ASC_KEY_CONTENT
# MATCH_GIT_SSH_PRIVATE_KEY (for certificates)
```

### Check Railway Variables

```bash
# Go to Railway dashboard
https://railway.app/project/<your-project-id>/settings

# Verify these exist:
DATABASE_URL
NEXT_PUBLIC_ELECTRIC_URL
NEXT_PUBLIC_ELECTRIC_SOURCE_ID
NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET
```

### Test Mobile App Logging

Once deployed to TestFlight:

1. Open mobile app
2. Tap **Log Viewer** button (bottom-right floating button)
3. Check logs for:
   ```
   [WriteBufferProvider] API Base: https://deeprecall-production.up.railway.app
   [Electric] Connected to: https://api.electric-sql.com/v1/shape
   [FlushWorker] POSTing to https://deeprecall-production.up.railway.app/api/writes/batch
   ```

### Test Railway API

```bash
# Health check
curl https://deeprecall-production.up.railway.app/api/health

# Postgres health
curl https://deeprecall-production.up.railway.app/api/health/postgres

# Test write API (requires valid change data)
curl -X POST https://deeprecall-production.up.railway.app/api/writes/batch \
  -H "Content-Type: application/json" \
  -d '{"changes":[]}'
# Should return: {"applied":[],"errors":[]}
```

---

## 6. Common Issues & Solutions

### Issue: Mobile app can't connect to Railway

**Symptoms:**

- Log viewer shows: "Error connecting to https://deeprecall-production.up.railway.app"
- Write buffer retries indefinitely

**Solutions:**

1. Check GitHub secret: `VITE_API_BASE_URL` is set correctly
2. Rebuild iOS app (secrets are bundled at build time)
3. Check Railway logs for CORS errors
4. Verify Railway app is running: `https://deeprecall-production.up.railway.app/api/health`

### Issue: Mobile app can't sync from Electric

**Symptoms:**

- No data appears in mobile app
- Log viewer shows: "Electric connection failed"

**Solutions:**

1. Check GitHub secrets: `VITE_ELECTRIC_*` variables are correct
2. Verify Electric Cloud source is active: https://console.electric-sql.com/
3. Check if Postgres is accessible from Electric Cloud (firewall rules)
4. Use `"development"` sync mode, not `"production"` (SSE unreliable)

### Issue: Railway API can't connect to Postgres

**Symptoms:**

- `/api/health/postgres` returns 500 error
- Railway logs show: "Connection timeout"

**Solutions:**

1. Verify `DATABASE_URL` in Railway variables
2. Check Neon dashboard for connection limits
3. Restart Railway service
4. Check Neon IP allowlist (if configured)

### Issue: Electric not receiving Postgres changes

**Symptoms:**

- Data written to Postgres doesn't appear in mobile/web apps
- Electric console shows no activity

**Solutions:**

1. Verify Postgres has `wal_level = logical` (required for replication)
2. Check Electric Cloud source status
3. Restart Electric Cloud source
4. Verify network connectivity (Postgres → Electric Cloud)

---

## 7. Environment Variable Reference Table

| Variable                             | Location          | Purpose                             | Example                                        |
| ------------------------------------ | ----------------- | ----------------------------------- | ---------------------------------------------- |
| `VITE_ELECTRIC_URL`                  | GitHub Secrets    | Electric API endpoint               | `https://api.electric-sql.com/v1/shape`        |
| `VITE_ELECTRIC_SOURCE_ID`            | GitHub Secrets    | Electric source identifier          | `7efa2a2d-20ad-472b-b2bd-4a6110c26d5c`         |
| `VITE_ELECTRIC_SOURCE_SECRET`        | GitHub Secrets    | Electric JWT token                  | `eyJ0eXAiOiJKV1Qi...`                          |
| `VITE_API_BASE_URL`                  | GitHub Secrets    | Railway web app URL                 | `https://deeprecall-production.up.railway.app` |
| `VITE_BLOB_STORAGE_MODE`             | GitHub Secrets    | Blob storage backend                | `native` or `cloudflare`                       |
| `DATABASE_URL`                       | Railway Variables | Postgres connection string          | `postgresql://user:pass@host/db`               |
| `NEXT_PUBLIC_ELECTRIC_URL`           | Railway Variables | Electric API (must match mobile)    | Same as `VITE_ELECTRIC_URL`                    |
| `NEXT_PUBLIC_ELECTRIC_SOURCE_ID`     | Railway Variables | Electric source (must match mobile) | Same as `VITE_ELECTRIC_SOURCE_ID`              |
| `NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET` | Railway Variables | Electric secret (must match mobile) | Same as `VITE_ELECTRIC_SOURCE_SECRET`          |

---

## 8. Next Steps

1. **Verify GitHub Secrets** are set correctly
2. **Verify Railway Variables** match GitHub secrets (for Electric config)
3. **Build mobile app** with GitHub Actions (secrets will be injected)
4. **Deploy to TestFlight** and test with log viewer
5. **Monitor logs** in Railway dashboard for API activity
6. **Check Electric Cloud** console for sync activity

---

## Debugging Commands

```bash
# Check environment info in mobile app console
window.__deeprecall_environment = {
  electricUrl: import.meta.env.VITE_ELECTRIC_URL,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
};

# Check Railway logs
railway logs --project deeprecall-production

# Check Electric Cloud status
curl https://api.electric-sql.com/v1/health

# Test write buffer locally
await window.__deeprecall_flush_worker.flush()
await window.__deeprecall_buffer.getStats()
```
