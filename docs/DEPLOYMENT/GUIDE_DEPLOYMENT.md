# Deployment Guide

**Last Updated**: November 2025  
**Status**: Production-ready for Web + Mobile, Desktop releases manually

This guide provides a high-level overview of deploying DeepRecall across all platforms. For platform-specific details, see the individual guides.

---

## Table of Contents

1. [Overview](#overview)
2. [Deployment Matrix](#deployment-matrix)
3. [Shared Infrastructure](#shared-infrastructure)
4. [Quick Start](#quick-start)
5. [Platform-Specific Guides](#platform-specific-guides)

---

## Overview

DeepRecall uses a **multi-platform architecture** with shared cloud infrastructure:

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Clients   │────────▶│   Railway Web    │────────▶│  Postgres   │
│ Web/Desktop │         │    (Next.js)     │         │   (Neon)    │
│   Mobile    │         └──────────────────┘         └─────────────┘
└─────────────┘                                              ▲
      │                                                      │
      └──────────────────▶ Electric Cloud ◀──────────────────┘
                          (Real-time Sync)
```

**Data Flow**:

- **Reads (Real-time)**: Clients ← Electric Cloud ← Postgres
- **Writes (Optimistic)**: Clients → Local → WriteBuffer → Railway API → Postgres → Electric → All Clients

---

## Deployment Matrix

| Platform    | Method         | Trigger        | Deploy Time | Status         |
| ----------- | -------------- | -------------- | ----------- | -------------- |
| **Web**     | Railway auto   | Push to `main` | ~5 min      | ✅ Production  |
| **Mobile**  | GitHub Actions | Manual/Push    | ~15 min     | ✅ TestFlight  |
| **Desktop** | Manual release | Tag push       | ~10 min     | 🟡 Manual only |

---

## Shared Infrastructure

### 1. Postgres Database (Neon)

**Provider**: [Neon](https://neon.tech)  
**Plan**: Free tier (upgrade as needed)  
**Purpose**: Source of truth for all data

**Connection Details**:

- Host: `ep-late-cell-ag9og5sf.c-2.eu-central-1.aws.neon.tech`
- Database: `neondb`
- User: `neondb_owner`
- SSL: Required

**Migrations**: Auto-applied on Railway web app startup (`migrations/*.sql`)

---

### 2. Electric Cloud (Real-time Sync)

**Provider**: [Electric SQL Cloud](https://electric-sql.com)  
**Plan**: Beta (free)  
**Purpose**: Real-time Postgres replication to all clients

**Configuration**:

```bash
VITE_ELECTRIC_URL=https://deeprecall-production.up.railway.app/api/electric
VITE_ELECTRIC_SOURCE_ID=7efa2a2d-20ad-472b-b2bd-4a6110c26d5c
VITE_ELECTRIC_SOURCE_SECRET=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

**Auth Method**: Query parameters (`source_id` + `secret` in URL)  
**Sync Mode**: Polling (10s interval) - more reliable than SSE for cloud setup

---

### 3. Railway (Web Backend)

**Provider**: [Railway](https://railway.app)  
**Plan**: Hobby/Pro  
**Purpose**: Next.js backend for web UI + API gateway for mobile writes

**Auto-Deploy**: On push to `main` branch  
**Build**: Defined in `apps/web/railway.json`  
**URL**: `https://deeprecall-production.up.railway.app`

---

## Quick Start

### Prerequisites

All platforms require:

- ✅ Neon Postgres database (already configured)
- ✅ Electric Cloud source (already configured)
- ✅ Railway account (for web backend)

Platform-specific:

- **Web**: Railway environment variables
- **Mobile**: GitHub Actions secrets + Apple Developer account
- **Desktop**: Code signing certificate (Windows/macOS)

---

### Deploy Web (2 minutes)

1. **Set Railway environment variables** (one-time):

   ```bash
   DATABASE_URL=<neon-postgres-url>
   NEXT_PUBLIC_ELECTRIC_URL=https://deeprecall-production.up.railway.app/api/electric
   NEXT_PUBLIC_ELECTRIC_SOURCE_ID=7efa2a2d-20ad-472b-b2bd-4a6110c26d5c
   NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET=<your-secret>
   ```

2. **Deploy**:
   ```bash
   git push origin main
   ```

That's it! Railway auto-deploys. See [GUIDE_DEPLOY_WEB.md](./GUIDE_DEPLOY_WEB.md) for details.

---

### Deploy Mobile (15 minutes first time, 5 minutes after)

1. **Set GitHub secrets** (one-time):
   - `VITE_ELECTRIC_URL`, `VITE_ELECTRIC_SOURCE_ID`, `VITE_ELECTRIC_SOURCE_SECRET`
   - `VITE_API_BASE_URL` (Railway URL)
   - `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_CONTENT` (Apple credentials)
   - `MATCH_GIT_SSH_PRIVATE_KEY`, `P12_PASSWORD` (code signing)

2. **Deploy**:
   - Go to GitHub Actions → "iOS → TestFlight" → Run workflow
   - Or push to `main` (if workflow configured for auto-trigger)

See [GUIDE_DEPLOY_MOBILE.md](./GUIDE_DEPLOY_MOBILE.md) for full setup.

---

### Deploy Desktop (Manual)

Desktop releases are currently **manual**. Build locally and distribute:

```bash
cd apps/desktop
pnpm run build  # Creates installer in src-tauri/target/release/bundle/
```

See [GUIDE_DEPLOY_DESKTOP.md](./GUIDE_DEPLOY_DESKTOP.md) for code signing and distribution.

---

## Environment Variables Summary

### Web (Railway)

| Variable                             | Value                                   | Required |
| ------------------------------------ | --------------------------------------- | -------- |
| `DATABASE_URL`                       | Neon Postgres connection string         | ✅       |
| `NEXT_PUBLIC_ELECTRIC_URL`           | Electric Cloud shape endpoint           | ✅       |
| `NEXT_PUBLIC_ELECTRIC_SOURCE_ID`     | Electric source ID                      | ✅       |
| `NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET` | Electric source secret                  | ✅       |
| `NEXTAUTH_URL`                       | Production domain                       | ✅       |
| `AUTH_SECRET`                        | NextAuth secret (generate with openssl) | ✅       |
| `AUTH_GOOGLE_ID`                     | Google OAuth client ID                  | 🟡       |
| `AUTH_GOOGLE_SECRET`                 | Google OAuth secret                     | 🟡       |
| `AUTH_GITHUB_ID`                     | GitHub OAuth client ID                  | 🟡       |
| `AUTH_GITHUB_SECRET`                 | GitHub OAuth secret                     | 🟡       |

---

### Mobile (GitHub Secrets)

| Secret                        | Value                         | Required |
| ----------------------------- | ----------------------------- | -------- |
| `VITE_ELECTRIC_URL`           | Electric Cloud shape endpoint | ✅       |
| `VITE_ELECTRIC_SOURCE_ID`     | Electric source ID            | ✅       |
| `VITE_ELECTRIC_SOURCE_SECRET` | Electric source secret        | ✅       |
| `VITE_API_BASE_URL`           | Railway web app URL           | ✅       |
| `ASC_KEY_ID`                  | App Store Connect key ID      | ✅       |
| `ASC_ISSUER_ID`               | App Store Connect issuer ID   | ✅       |
| `ASC_KEY_CONTENT`             | App Store Connect API key     | ✅       |
| `MATCH_GIT_SSH_PRIVATE_KEY`   | SSH key for certificates repo | ✅       |
| `P12_PASSWORD`                | Certificate password          | ✅       |

---

### Desktop (Local .env.local)

| Variable                            | Value                         | Required |
| ----------------------------------- | ----------------------------- | -------- |
| `VITE_POSTGRES_HOST`                | Neon Postgres host            | ✅       |
| `VITE_POSTGRES_DB`                  | Database name                 | ✅       |
| `VITE_POSTGRES_USER`                | Database user                 | ✅       |
| `VITE_POSTGRES_PASSWORD`            | Database password             | ✅       |
| `VITE_ELECTRIC_URL`                 | Electric Cloud shape endpoint | ✅       |
| `VITE_ELECTRIC_SOURCE_ID`           | Electric source ID            | ✅       |
| `VITE_ELECTRIC_SOURCE_SECRET`       | Electric source secret        | ✅       |
| `VITE_GOOGLE_DESKTOP_CLIENT_ID`     | Google OAuth desktop client   | 🟡       |
| `VITE_GOOGLE_DESKTOP_CLIENT_SECRET` | Google OAuth secret           | 🟡       |
| `VITE_GITHUB_DESKTOP_CLIENT_ID`     | GitHub OAuth client           | 🟡       |

---

## Platform-Specific Guides

- **[GUIDE_DEPLOY_WEB.md](./GUIDE_DEPLOY_WEB.md)** - Railway deployment, environment setup, troubleshooting
- **[GUIDE_DEPLOY_MOBILE.md](./GUIDE_DEPLOY_MOBILE.md)** - TestFlight automation, code signing, GitHub Actions
- **[GUIDE_DEPLOY_DESKTOP.md](./GUIDE_DEPLOY_DESKTOP.md)** - Manual builds, code signing, distribution

---

## Common Issues

### Electric sync not working

**Symptoms**: Data not syncing between devices

**Checklist**:

1. Verify Electric Cloud credentials match across all platforms
2. Check Neon Postgres has logical replication enabled
3. Verify Electric source is connected to correct database
4. Check browser console/logs for Electric errors

---

### Mobile writes not reaching Postgres

**Symptoms**: Mobile changes don't sync to other devices

**Checklist**:

1. Verify `VITE_API_BASE_URL` points to correct Railway URL
2. Check Railway logs for `/api/writes/batch` errors
3. Verify WriteBuffer flush worker is running (check mobile logs)
4. Check network connectivity (mobile may be offline)

---

### OAuth not working

**Symptoms**: Sign-in fails or redirects incorrectly

**Checklist**:

1. Verify OAuth client IDs/secrets are correct
2. Check authorized redirect URIs in OAuth provider console
3. For mobile: verify custom URL scheme in `Info.plist`
4. For desktop: check PKCE flow implementation

---

## Monitoring & Observability

### Production Checklist

- [ ] Railway health checks passing (`/api/health`)
- [ ] Electric Cloud source status: Active
- [ ] Neon Postgres metrics: No errors
- [ ] Mobile TestFlight build successfully uploaded
- [ ] Desktop release artifacts generated

### Recommended Tools

- **Railway**: Built-in logs and metrics
- **Neon**: Database insights and query performance
- **Electric Cloud**: Sync status dashboard
- **Sentry** (future): Error tracking and crash reporting
- **OpenTelemetry** (future): Distributed tracing

---

## Next Steps

After successful deployment:

1. **Test cross-platform sync**: Create data on web, verify it appears on mobile
2. **Monitor WriteBuffer**: Check logs for flush errors or retries
3. **Set up alerts**: Railway health checks, database connection errors
4. **Plan scaling**: Upgrade Neon/Railway plans as user base grows
5. **Add telemetry**: Implement OpenTelemetry for production observability

---

## Related Guides

- **Architecture**: [GUIDE_DATA_ARCHITECTURE.md](../ARCHITECTURE/GUIDE_DATA_ARCHITECTURE.md)
- **Mobile Platform**: [GUIDE_MOBILE.md](../ARCHITECTURE/GUIDE_MOBILE.md)
- **Desktop Platform**: [GUIDE_DESKTOP.md](../ARCHITECTURE/GUIDE_DESKTOP.md)
- **Authentication**: [GUIDE_AUTHENTICATION.md](../AUTH/GUIDE_AUTHENTICATION.md)
