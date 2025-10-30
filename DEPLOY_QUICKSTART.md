# Quick Start: Production Deployment

## 🚀 TL;DR - Deploy Now

### Web (Railway) - Automatic on Push

```bash
git push origin main
```

That's it! Railway auto-deploys. Just ensure these environment variables are set in Railway dashboard:

```
NEXT_PUBLIC_ELECTRIC_URL=https://api.electric-sql.cloud/v1/shape
NEXT_PUBLIC_ELECTRIC_SOURCE_ID=<your-id>
NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET=<your-secret>
DATABASE_URL=<neon-postgres-url>
```

### Mobile (TestFlight) - Automatic on Push

```bash
git push origin main
```

GitHub Actions auto-builds and uploads to TestFlight. First time setup requires adding these secrets to GitHub:

**Go to**: https://github.com/RnLe/DeepRecall/settings/secrets/actions

**Add these secrets:**

- `VITE_ELECTRIC_URL` = `https://api.electric-sql.cloud/v1/shape`
- `VITE_ELECTRIC_SOURCE_ID` = `<your-electric-source-id>`
- `VITE_ELECTRIC_SOURCE_SECRET` = `<your-electric-secret>`
- `VITE_API_BASE_URL` = `https://your-app.railway.app`

---

## ✅ Pre-Deployment Checklist

### Web

- [ ] Railway environment variables set
- [ ] Database connection string configured
- [ ] Test local build: `cd apps/web && pnpm run build`

### Mobile

- [ ] GitHub secrets configured
- [ ] Create local `.env.production` from template
- [ ] Test local build: `cd apps/mobile && pnpm run build:ios`

---

## 🔧 Important Configuration Notes

### Electric Sync Mode ✅ Already Configured Correctly

The code uses **polling mode** (10s interval) which is the **correct production setting**:

```typescript
// packages/data/src/electric.ts
const SYNC_MODE: "development" | "production" = "development"; // ✅ Keep this!
```

**Why?** Electric Cloud's SSE (`liveSse: true`) had reliability issues. Polling works perfectly for real-time sync.

**Do NOT change this to "production"** - the naming is confusing but development mode = polling = reliable.

---

## 📦 What Gets Deployed

### Web (Railway)

- Build command: `pnpm install && cd apps/web && pnpm run build`
- Start command: `cd apps/web && pnpm start`
- Environment: Production (NODE_ENV=production)
- Electric: Polling mode (10s interval)

### Mobile (TestFlight)

- Build command: `pnpm run build:ios` (production mode)
- Target: iOS App Store Distribution
- Environment: Production (Vite production mode)
- Electric: Polling mode (10s interval)

---

## 🐛 Common Issues

### Web: "Electric not initialized"

**Fix:** Check Railway environment variables are set (NEXT*PUBLIC_ELECTRIC*\*)

### Mobile: Build fails in GitHub Actions

**Fix:** Verify GitHub secrets are configured correctly

### Mobile: App crashes on launch

**Fix:** Check `VITE_API_BASE_URL` points to deployed Railway URL (not localhost)

---

## 📖 Full Documentation

See `PRODUCTION_DEPLOYMENT_CHECKLIST.md` for complete deployment guide with:

- Step-by-step instructions
- Troubleshooting guide
- Rollback procedures
- Post-deployment verification

---

## 🔒 Security Notes

- Never commit `.env.local` or `.env.production` files
- All secrets are in Railway dashboard or GitHub Actions secrets
- Mobile environment variables are bundled at build time
- Electric credentials are safe to expose client-side (scoped to read-only shapes)
