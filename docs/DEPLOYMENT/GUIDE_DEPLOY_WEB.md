# Web Deployment Guide (Railway)

**Platform**: Next.js on Railway  
**Deploy Method**: Auto-deploy on push to `main`  
**Build Time**: ~5 minutes

This guide covers deploying the DeepRecall web app to Railway.

---

## Prerequisites

- Railway account ([railway.app](https://railway.app))
- Neon Postgres database (already configured)
- Electric Cloud source (already configured)
- GitHub repository connected to Railway

---

## One-Time Setup

### 1. Connect GitHub to Railway

1. Go to [railway.app/new](https://railway.app/new)
2. Select "Deploy from GitHub repo"
3. Choose `RnLe/DeepRecall` repository
4. Railway will auto-detect `apps/web/railway.json` configuration

### 2. Configure Environment Variables

In Railway dashboard → Variables, add:

```bash
# Database (Required)
DATABASE_URL=postgresql://neondb_owner:PASSWORD@ep-late-cell-ag9og5sf.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require

# Electric Cloud (Required - proxied to avoid CORS)
NEXT_PUBLIC_ELECTRIC_URL=https://deeprecall-production.up.railway.app/api/electric
NEXT_PUBLIC_ELECTRIC_SOURCE_ID=7efa2a2d-20ad-472b-b2bd-4a6110c26d5c
NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET=<your-electric-source-secret>

# NextAuth (Required for authentication)
NEXTAUTH_URL=https://deeprecall-production.up.railway.app
AUTH_SECRET=<generate with: openssl rand -base64 32>

# OAuth Providers (Optional - for social login)
AUTH_GOOGLE_ID=<your-google-oauth-client-id>
AUTH_GOOGLE_SECRET=<your-google-oauth-client-secret>
AUTH_GITHUB_ID=<your-github-oauth-client-id>
AUTH_GITHUB_SECRET=<your-github-oauth-client-secret>

# Desktop/Mobile Auth Broker (Optional - for native apps)
APP_JWT_SECRET=<generate with: openssl rand -base64 32>
```

**Important Notes**:

- `DATABASE_URL`: Get from Neon dashboard (connection string with `?sslmode=require`)
- `NEXTAUTH_URL`: Replace with your actual Railway domain
- `AUTH_SECRET`: Generate unique secret (never reuse across environments)
- OAuth credentials: Only needed if enabling Google/GitHub sign-in

---

## Build Configuration

Railway uses `apps/web/railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd ../.. && pnpm install && cd apps/web && pnpm run build",
    "watchPatterns": ["apps/web/**", "packages/**"]
  },
  "deploy": {
    "startCommand": "cd apps/web && pnpm start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**How it works**:

1. Installs pnpm dependencies from monorepo root
2. Builds shared packages (`@deeprecall/core`, `@deeprecall/data`, etc.)
3. Builds Next.js app in production mode
4. Starts Next.js server with `pnpm start`
5. Health checks `/api/health` endpoint

---

## Deploying

### Automatic Deployment

Every push to `main` triggers auto-deploy:

```bash
git add .
git commit -m "feat: add new feature"
git push origin main
```

Railway will:

1. Detect changes via `watchPatterns`
2. Run build command (~3-4 min)
3. Deploy new version (~1 min)
4. Run health checks
5. Serve traffic on new deployment

### Manual Deployment

Trigger manual deploy in Railway dashboard:

1. Go to project → Deployments
2. Click "Deploy" on any previous deployment
3. Or redeploy latest from GitHub

---

## Database Migrations

Migrations run automatically on startup via `apps/web/src/app/layout.tsx`:

```typescript
// Apply migrations on server startup
if (typeof window === "undefined") {
  import("@/server/migrations").then(({ applyMigrations }) => {
    applyMigrations();
  });
}
```

**Migration files**: `migrations/*.sql` (run in alphanumeric order)

**Current migrations**:

1. `001_initial_schema.sql` - Base tables
2. `002_blob_coordination.sql` - Blob metadata tables
3. `003_fix_annotation_id_type.sql` - UUID fixes
4. `004_boards_and_strokes.sql` - Whiteboard tables
5. `005_shape_metadata.sql` - Annotation geometry
6. `006_app_users_auth.sql` - Auth tables
7. `007_rls_multi_tenant.sql` - Row-level security
8. `008_account_linking.sql` - Guest user upgrades

**Adding new migrations**:

1. Create `migrations/009_new_migration.sql`
2. Push to main → Railway auto-applies

---

## Monitoring

### Health Checks

Railway automatically pings `/api/health` every 100 seconds:

```typescript
// apps/web/app/api/health/route.ts
export async function GET() {
  return Response.json({ status: "ok", timestamp: Date.now() });
}
```

**Failed health checks**: Railway auto-restarts (max 10 retries)

### Logs

View logs in Railway dashboard:

```bash
# Or use Railway CLI
railway logs
```

**Key log patterns**:

- `[Electric] Initialized` - Electric client connected
- `[Migration]` - Database migration applied
- `[WriteBuffer]` - Batch write flush
- `ERROR` - Application errors

---

## Testing Before Deploy

### Local Production Build

```bash
cd apps/web

# Create production .env.local
cp .env.example .env.local
# Fill in production values

# Build
pnpm run build

# Test production server
pnpm start
```

Open http://localhost:3000 and verify:

- ✅ Electric sync working (browser console logs)
- ✅ Database queries returning data
- ✅ OAuth sign-in working (if configured)
- ✅ No build errors in terminal

---

## Troubleshooting

### Build Fails: "pnpm not found"

**Cause**: Railway not detecting pnpm workspace

**Fix**: Verify `railway.json` exists in `apps/web/` and `pnpm-workspace.yaml` in root

---

### Runtime Error: "DATABASE_URL not defined"

**Cause**: Missing environment variable

**Fix**: Add `DATABASE_URL` in Railway dashboard → Variables

---

### Electric sync not working

**Symptoms**: Browser console shows "Electric connection failed"

**Checklist**:

1. Verify `NEXT_PUBLIC_ELECTRIC_*` vars set in Railway
2. Check Electric Cloud dashboard - source should be "Active"
3. Verify Neon Postgres has logical replication enabled
4. Check browser network tab for Electric requests (should be polling every 10s)

---

### OAuth redirect fails

**Symptoms**: "Redirect URI mismatch" error

**Fix**: Update OAuth provider authorized redirect URIs:

- Google: https://console.cloud.google.com/apis/credentials
  - Add: `https://deeprecall-production.up.railway.app/api/auth/callback/google`
- GitHub: https://github.com/settings/developers
  - Add: `https://deeprecall-production.up.railway.app/api/auth/callback/github`

---

### Deployment succeeds but app shows 500 error

**Symptoms**: Railway deploy succeeds, but app returns 500

**Common causes**:

1. Database migration failed - check Railway logs for `[Migration] ERROR`
2. Missing required env var - check for `undefined` in logs
3. Postgres connection failed - verify `DATABASE_URL` format

**Debug**:

```bash
railway logs --tail 100
```

---

## Performance Optimization

### Enable Edge Runtime (Optional)

For faster API routes, use Edge runtime:

```typescript
// apps/web/app/api/some-route/route.ts
export const runtime = "edge";
```

**Limitations**: No Node.js APIs (fs, path, etc.)

### CDN/Caching

Railway includes CDN by default for static assets. For additional caching:

1. Add `Cache-Control` headers to API routes
2. Use Next.js `revalidate` for ISR pages
3. Consider Cloudflare in front of Railway

---

## Scaling

### Vertical Scaling (Upgrade Plan)

- **Hobby**: 512MB RAM, 0.5 vCPU ($5/month)
- **Pro**: 8GB RAM, 8 vCPU ($20/month)

Upgrade in Railway dashboard → Project Settings

### Horizontal Scaling

Railway supports multiple instances (Pro plan):

1. Dashboard → Project → Settings → Instances
2. Set desired replica count
3. Railway auto-load balances

**Note**: Session storage must be database-backed (not in-memory)

---

## Rollback

If deployment breaks production:

1. Railway dashboard → Deployments
2. Find last working deployment
3. Click "Redeploy"
4. Traffic switches to old version immediately

---

## Related Guides

- **Main Deployment Guide**: [GUIDE_DEPLOYMENT.md](./GUIDE_DEPLOYMENT.md)
- **Mobile Deployment**: [GUIDE_DEPLOY_MOBILE.md](./GUIDE_DEPLOY_MOBILE.md)
- **Data Architecture**: [GUIDE_DATA_ARCHITECTURE.md](../ARCHITECTURE/GUIDE_DATA_ARCHITECTURE.md)
- **Authentication**: [GUIDE_AUTHENTICATION.md](../AUTH/GUIDE_AUTHENTICATION.md)
