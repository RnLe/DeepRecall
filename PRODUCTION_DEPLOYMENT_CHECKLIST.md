# Production Deployment Checklist

## Overview

This document outlines the steps to prepare DeepRecall for production deployment to Railway (web) and TestFlight (mobile).

## Important: Electric Sync Mode

**Current Configuration**: The codebase is hardcoded to use `"development"` mode (10s polling) in `packages/data/src/electric.ts`:

```typescript
const SYNC_MODE: "development" | "production" = "development";
```

**Why Polling Instead of SSE?**

- Electric Cloud's SSE implementation (`liveSse: true`) had reliability issues detecting live changes
- 10-second polling works perfectly for real-time sync
- The names are confusing: "development" = polling (reliable), "production" = SSE (unreliable for Electric Cloud)

**Action Required**: ✅ **No changes needed** - keep polling mode for production deployment.

---

## Web App (Railway) Deployment

### 1. Environment Variables (Railway Dashboard)

Set these in your Railway project's environment variables:

```bash
# Database
DATABASE_URL=<your-neon-postgres-connection-string>

# Electric Cloud (Client-side - exposed to browser)
NEXT_PUBLIC_ELECTRIC_URL=https://api.electric-sql.cloud/v1/shape
NEXT_PUBLIC_ELECTRIC_SOURCE_ID=<your-electric-source-id>
NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET=<your-electric-source-secret>
```

### 2. Verify Railway Configuration

Railway auto-deploys when you push to `main` branch. The build configuration is in `apps/web/railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd ../.. && pnpm install && cd apps/web && pnpm run build",
    "watchPatterns": ["apps/web/**", "packages/**"]
  },
  "deploy": {
    "startCommand": "cd apps/web && pnpm start"
  }
}
```

### 3. Pre-Deployment Checks

```bash
# From project root
cd apps/web

# Test production build locally
pnpm run build
pnpm start

# Verify Electric connection in browser console
# Should see: [Electric] Initialized with URL: https://api.electric-sql.cloud/v1/shape
```

---

## Mobile App (TestFlight) Deployment

### 1. Create Production Environment File

Create `apps/mobile/.env.production` (gitignored):

```bash
# Electric Cloud (Production)
VITE_ELECTRIC_URL=https://api.electric-sql.cloud/v1/shape
VITE_ELECTRIC_SOURCE_ID=<your-electric-source-id>
VITE_ELECTRIC_SOURCE_SECRET=<your-electric-source-secret>

# HTTP API (Production - your deployed Railway URL)
VITE_API_BASE_URL=https://your-app.railway.app

# Blob Storage Mode
VITE_BLOB_STORAGE_MODE=native
```

### 2. Update GitHub Actions Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

```bash
# Electric Cloud credentials (if not already added)
VITE_ELECTRIC_URL=https://api.electric-sql.cloud/v1/shape
VITE_ELECTRIC_SOURCE_ID=<your-electric-source-id>
VITE_ELECTRIC_SOURCE_SECRET=<your-electric-source-secret>
VITE_API_BASE_URL=https://your-app.railway.app

# Existing secrets (already configured)
ASC_KEY_ID=<app-store-connect-key-id>
ASC_ISSUER_ID=<app-store-connect-issuer-id>
ASC_KEY_CONTENT=<app-store-connect-key-base64>
MATCH_GIT_SSH_PRIVATE_KEY=<ssh-key-for-certificates-repo>
P12_PASSWORD=<certificate-password>
```

### 3. Update GitHub Workflow

Edit `.github/workflows/ios-testflight.yml` to inject environment variables during build:

```yaml
- name: Build mobile web assets & sync iOS (Capacitor)
  working-directory: apps/mobile
  env:
    VITE_ELECTRIC_URL: ${{ secrets.VITE_ELECTRIC_URL }}
    VITE_ELECTRIC_SOURCE_ID: ${{ secrets.VITE_ELECTRIC_SOURCE_ID }}
    VITE_ELECTRIC_SOURCE_SECRET: ${{ secrets.VITE_ELECTRIC_SOURCE_SECRET }}
    VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
    VITE_BLOB_STORAGE_MODE: native
  run: |
    pnpm run build:ios
    npx cap sync ios
```

### 4. Test Production Build Locally

```bash
cd apps/mobile

# Build with production environment
pnpm run build:ios

# Sync to iOS
npx cap sync ios

# Open in Xcode and test
npx cap open ios
```

### 5. Verify Mobile Configuration

Check `apps/mobile/src/config/api.ts` to ensure it reads from environment:

```typescript
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
}
```

---

## Pre-Commit Verification

### 1. Local Build Tests

```bash
# Test web build
cd apps/web
pnpm run build

# Test mobile build
cd apps/mobile
pnpm run build:ios
```

### 2. Check Environment Files

```bash
# Web production env should be set in Railway dashboard
# Mobile production env should exist locally
ls -la apps/mobile/.env.production

# Verify gitignore (these should NOT be committed)
cat .gitignore | grep -E "\.env\.local|\.env\.production"
```

### 3. Verify Electric Configuration

```bash
# Check that SYNC_MODE is set correctly
grep -n "SYNC_MODE" packages/data/src/electric.ts
# Should show: const SYNC_MODE: "development" | "production" = "development";
```

---

## Deployment Process

### Web Deployment (Railway)

1. **Commit and push to main:**

   ```bash
   git add .
   git commit -m "chore: prepare for production deployment"
   git push origin main
   ```

2. **Railway auto-deploys** - monitor in Railway dashboard:
   - Build logs will show: `cd ../.. && pnpm install && cd apps/web && pnpm run build`
   - Deploy logs will show: `cd apps/web && pnpm start`

3. **Verify deployment:**
   - Visit `https://your-app.railway.app`
   - Open browser console
   - Look for: `[Electric] Initialized with URL: https://api.electric-sql.cloud/v1/shape`
   - Check network tab for Electric shape requests (10s polling)

### Mobile Deployment (TestFlight)

1. **GitHub Actions auto-triggers** on push to `main`:
   - Builds mobile app with production environment
   - Signs with App Store certificates
   - Uploads to TestFlight

2. **Monitor GitHub Actions:**
   - Go to: https://github.com/RnLe/DeepRecall/actions
   - Watch "iOS → TestFlight" workflow
   - Check logs for build errors

3. **Verify in TestFlight:**
   - Wait ~10 minutes for processing
   - Install from TestFlight on iOS device
   - Check Settings → About → Version number
   - Verify Electric connection in app logs

---

## Troubleshooting

### Web: Electric Connection Failed

**Symptoms:**

- Console shows: `[Electric] Shape error`
- No data loading

**Fix:**

```bash
# Check Railway environment variables
railway variables
# Ensure NEXT_PUBLIC_ELECTRIC_* are set correctly
```

### Mobile: Build Failed in GitHub Actions

**Symptoms:**

- Workflow fails at "Build mobile web assets"
- Error: "VITE_ELECTRIC_URL is not defined"

**Fix:**

1. Verify GitHub secrets are set: Settings → Secrets → Actions
2. Check workflow YAML has `env:` block with secrets
3. Re-run workflow

### Mobile: App Crashes on Launch

**Symptoms:**

- TestFlight app crashes immediately
- Logs show: "Electric not initialized"

**Fix:**

1. Check `apps/mobile/src/providers.tsx` reads from `import.meta.env`
2. Verify build used production environment: `pnpm run build:ios`
3. Ensure `capacitor.config.ts` has correct server URL

### Mobile: Upload Failed - "Bundle version already used"

**Symptoms:**

- Fastlane fails at `upload_to_testflight`
- Error: `The bundle version must be higher than the previously uploaded version`

**Fix:**

This is now handled automatically! The Fastlane configuration queries App Store Connect for the latest build number and increments it. If you see this error, it means:

1. The `latest_testflight_build_number` API call failed (check ASC credentials)
2. Or you're re-running a failed build without changes

To manually fix:

```bash
cd apps/mobile/ios/App
# Check current build number
agvtool what-version
# Set new build number (must be higher than TestFlight)
agvtool new-version -all 3
```

---

## Post-Deployment Verification

### Web Checklist

- [ ] Web app loads at production URL
- [ ] Electric connection established (check browser console)
- [ ] Can create/edit/delete works
- [ ] Blob upload works
- [ ] Device coordination shows correct device ID

### Mobile Checklist

- [ ] App installs from TestFlight
- [ ] Electric connection established (check in-app logs)
- [ ] Can sync data from web
- [ ] Local blob storage works
- [ ] "Sync to Electric" coordination works
- [ ] Blob status badges show correctly

---

## Rollback Plan

### Web Rollback (Railway)

1. Go to Railway deployment history
2. Click "Redeploy" on previous stable version

### Mobile Rollback (TestFlight)

1. TestFlight keeps previous builds
2. Users can downgrade in TestFlight app
3. For emergency: submit new build with hotfix

---

## Notes

- **Electric Sync Mode**: Keep `SYNC_MODE = "development"` (polling) - it's more reliable than SSE for Electric Cloud
- **Environment Files**: Never commit `.env.local` or `.env.production` - they contain secrets
- **Build Time**: Web builds ~2-3 minutes, Mobile builds ~10-15 minutes
- **TestFlight Review**: No review required for internal testing, but new builds need 10 minutes processing

---

## Contact

If issues arise during deployment:

1. Check Railway logs: `railway logs`
2. Check GitHub Actions logs: Actions tab in repo
3. Review Electric Cloud dashboard: https://console.electric-sql.com/
