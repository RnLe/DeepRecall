# Pre-Deployment Checklist

## 🔍 Environment Variables Audit

### ✅ Your Current Configuration

**Electric Cloud:**

```bash
VITE_ELECTRIC_URL=https://api.electric-sql.cloud/v1/shape
VITE_ELECTRIC_SOURCE_ID=7efa2a2d-20ad-472b-b2bd-4a6110c26d5c
VITE_ELECTRIC_SOURCE_SECRET=<your-electric-source-secret>
```

**Railway:**

```bash
VITE_API_BASE_URL=https://deeprecall-production.up.railway.app
```

---

## 📋 Setup Tasks

### 1. GitHub Repository Secrets

**Required for iOS TestFlight builds**

Go to: https://github.com/RnLe/DeepRecall/settings/secrets/actions

**Mobile App Environment:**

- [ ] `VITE_ELECTRIC_URL` = `https://api.electric-sql.cloud/v1/shape`
- [ ] `VITE_ELECTRIC_SOURCE_ID` = `7efa2a2d-20ad-472b-b2bd-4a6110c26d5c`
- [ ] `VITE_ELECTRIC_SOURCE_SECRET` = `eyJ0eXAiOiJKV1Qi...` (your JWT token)
- [ ] `VITE_API_BASE_URL` = `https://deeprecall-production.up.railway.app`

**Apple Credentials (already set up):**

- [ ] `ASC_KEY_ID` (App Store Connect API Key ID)
- [ ] `ASC_ISSUER_ID` (App Store Connect Issuer ID)
- [ ] `ASC_KEY_CONTENT` (App Store Connect private key)
- [ ] `MATCH_GIT_SSH_PRIVATE_KEY` (SSH key for certificates repo)
- [ ] `P12_PASSWORD` (Certificate password)

### 2. Railway Environment Variables

**Required for web app + API gateway**

Go to: https://railway.app/project/YOUR_PROJECT_ID/settings

**Database:**

- [ ] `DATABASE_URL` (automatically provided if you add Postgres service)
  - Format: `postgresql://user:password@host:5432/database`

**Electric Cloud (must match mobile app!):**

- [ ] `NEXT_PUBLIC_ELECTRIC_URL` = `https://api.electric-sql.cloud/v1/shape`
- [ ] `NEXT_PUBLIC_ELECTRIC_SOURCE_ID` = `7efa2a2d-20ad-472b-b2bd-4a6110c26d5c`
- [ ] `NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET` = `eyJ0eXAiOiJKV1Qi...` (same token as mobile)

**Optional:**

- [ ] `NEXT_PUBLIC_BASE_URL` = `https://deeprecall-production.up.railway.app`
- [ ] `NODE_ENV` = `production`

### 3. Electric Cloud Configuration

Go to: https://console.electric-sql.com/

**Source Configuration:**

- [ ] Source ID: `7efa2a2d-20ad-472b-b2bd-4a6110c26d5c` exists
- [ ] Connected to your Postgres database
- [ ] Sync mode: `"development"` (polling, NOT SSE)
- [ ] Status: Active/Running

---

## 🧪 Testing Before Deployment

### Test 1: Railway Web App

```bash
# In apps/web directory
cd apps/web

# Build the app locally
pnpm run build

# Expected: No build errors
# If successful, Railway deployment will work
```

### Test 2: Railway API Endpoint

```bash
# Test health endpoint (should work immediately)
curl https://deeprecall-production.up.railway.app/api/health

# Test Postgres health (requires DATABASE_URL to be set)
curl https://deeprecall-production.up.railway.app/api/health/postgres

# Test write batch endpoint (should return empty success)
curl -X POST https://deeprecall-production.up.railway.app/api/writes/batch \
  -H "Content-Type: application/json" \
  -d '{"changes":[]}'
# Expected: {"applied":[],"errors":[]}
```

### Test 3: Electric Cloud Connection

```bash
# Test if Electric is reachable
curl "https://api.electric-sql.cloud/v1/shape/works?source_id=7efa2a2d-20ad-472b-b2bd-4a6110c26d5c&source_secret=<your-electric-source-secret>"

# Expected: JSON response with data or empty array
# If error: Check Electric Cloud console
```

---

## 🚀 Deployment Process

### Step 1: Deploy Railway

```bash
# Commit all changes
git add .
git commit -m "Production deployment setup"

# Push to main branch
git push origin main

# Railway auto-deploys from main branch
# Monitor: https://railway.app/project/YOUR_PROJECT_ID/deployments
```

**Wait for Railway deployment to complete before building mobile app!**

### Step 2: Build & Deploy iOS App

```bash
# GitHub Actions will automatically trigger on push to main
# Monitor: https://github.com/RnLe/DeepRecall/actions

# Or trigger manually:
# Go to: https://github.com/RnLe/DeepRecall/actions/workflows/ios-testflight.yml
# Click "Run workflow"
```

**Build takes ~20-30 minutes**

### Step 3: Test Mobile App

1. Download from TestFlight
2. Open app
3. Tap **Log Viewer** button (floating button, bottom-right)
4. Check for these logs:

   ```
   ✅ [WriteBufferProvider] API Base: https://deeprecall-production.up.railway.app
   ✅ [Electric] Connected to: https://api.electric-sql.cloud/v1/shape
   ✅ [FlushWorker] POSTing to https://deeprecall-production.up.railway.app/api/writes/batch
   ✅ [FlushWorker] Successfully applied 0 changes (initial sync)
   ```

5. Try creating a work/note
6. Check logs for:
   ```
   ✅ [WriteBuffer] Enqueued INSERT on works (id: xxx)
   ✅ [FlushWorker] Flushing 1 changes
   ✅ [FlushWorker] POSTing to ...
   ✅ [FlushWorker] Successfully applied 1 changes
   ```

---

## 🐛 Troubleshooting

### Issue: Mobile app shows "API Base: undefined"

**Cause:** GitHub secret `VITE_API_BASE_URL` not set

**Solution:**

1. Go to GitHub secrets
2. Add `VITE_API_BASE_URL` = `https://deeprecall-production.up.railway.app`
3. Rebuild iOS app (trigger GitHub Action again)

### Issue: Mobile app can't connect to Railway

**Logs show:** `Error: Network request failed`

**Solutions:**

1. Check Railway deployment is running: https://deeprecall-production.up.railway.app/api/health
2. Check GitHub secret `VITE_API_BASE_URL` matches Railway URL exactly (no trailing slash!)
3. Verify Railway CORS is configured (should allow `*` for mobile)
4. Check Railway logs for incoming requests

### Issue: Mobile app can't sync from Electric

**Logs show:** `Electric connection failed` or `ShapeStream error`

**Solutions:**

1. Verify Electric Cloud source is active: https://console.electric-sql.com/
2. Check GitHub secrets `VITE_ELECTRIC_*` are correct
3. Test Electric endpoint manually (see Test 3 above)
4. Check if Postgres has `wal_level = logical` (required for replication)

### Issue: Railway can't connect to Postgres

**Endpoint returns:** `{"error": "Connection timeout"}`

**Solutions:**

1. Check Railway variable `DATABASE_URL` is set
2. Verify Neon/Postgres is running and accessible
3. Check Postgres connection limits (max_connections)
4. Restart Railway service
5. Check Railway logs: `railway logs --project deeprecall-production`

---

## 📊 Monitoring & Logs

### Railway Logs

```bash
# View live logs (if Railway CLI installed)
railway logs --project deeprecall-production

# Or view in browser:
https://railway.app/project/YOUR_PROJECT_ID/deployments/latest
```

**What to look for:**

- `[WritesBatch] Processing X changes` - API is receiving writes
- `[PostgresPool] ✓ Connected` - Database connection is healthy
- `[FlushWorker] API endpoint called` - Mobile app is calling API

### Mobile App Logs (Log Viewer)

**Tap Log Viewer button in app to see:**

- Electric connection status
- Write buffer queue size
- API requests and responses
- Error messages

**Export logs:**

1. Tap **Export** button
2. Share via AirDrop/Messages
3. Analyze on desktop

### Electric Cloud Console

https://console.electric-sql.com/

**Check:**

- Source status (active/paused)
- Sync activity (recent operations)
- Error logs
- Connection health

---

## ✅ Success Criteria

Before marking deployment complete, verify:

### Railway (Web App)

- [ ] `/api/health` returns 200 OK
- [ ] `/api/health/postgres` returns 200 OK
- [ ] `/api/writes/batch` accepts empty changes array
- [ ] Railway logs show no errors

### Mobile App (TestFlight)

- [ ] App opens without crashes
- [ ] Log viewer shows Electric connection
- [ ] Log viewer shows Railway API base URL
- [ ] Can create/edit/delete works
- [ ] Changes sync to web app within 5 seconds

### Electric Cloud

- [ ] Source is active
- [ ] Recent sync activity visible
- [ ] No error messages in console

### Data Flow (End-to-End)

- [ ] Mobile → Railway → Postgres works (write)
- [ ] Postgres → Electric → Mobile works (read)
- [ ] Web → Railway → Postgres works (write)
- [ ] Postgres → Electric → Web works (read)

---

## 📝 Notes

### Important URLs

- **Railway Dashboard:** https://railway.app/
- **Railway App:** https://deeprecall-production.up.railway.app/
- **Electric Console:** https://console.electric-sql.com/
- **GitHub Actions:** https://github.com/RnLe/DeepRecall/actions
- **TestFlight:** https://appstoreconnect.apple.com/apps/YOUR_APP_ID/testflight

### Key Files Modified

- `.github/workflows/ios-testflight.yml` - GitHub Actions workflow
- `apps/mobile/src/config/api.ts` - API configuration
- `apps/mobile/src/providers/index.tsx` - Write buffer setup
- `apps/web/app/api/writes/batch/route.ts` - Write API endpoint
- `apps/web/app/providers.tsx` - Electric + Write buffer setup

### Temporary Debugging Tools

- **Log Viewer** (`packages/ui/src/admin/LogViewer.tsx`)
  - Added for debugging production issues
  - Remove after deployment is stable
  - See `MOBILE_LOGGER_TEMP.md` for removal instructions

---

## 🎯 Next Steps After Successful Deployment

1. **Monitor for 24 hours**
   - Check Railway logs daily
   - Monitor Electric Cloud activity
   - Review TestFlight crash reports

2. **Remove temporary debugging tools**
   - Follow `MOBILE_LOGGER_TEMP.md` to remove console logger
   - Clean up any debug console.logs

3. **Set up monitoring**
   - Railway: Configure alerts for errors/downtime
   - Sentry: Add error tracking (optional)
   - Analytics: Track app usage (optional)

4. **Plan for scaling**
   - Monitor Postgres connection pool usage
   - Watch Railway resource usage (RAM/CPU)
   - Consider upgrading Railway plan if needed

---

Ready to deploy! 🚀
