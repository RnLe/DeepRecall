# Mobile Deployment Guide (iOS TestFlight)

**Platform**: iOS via Capacitor  
**Deploy Method**: GitHub Actions → TestFlight  
**Build Time**: ~15 minutes

This guide covers deploying the DeepRecall mobile app to Apple TestFlight for beta testing.

---

## Prerequisites

- Apple Developer account ($99/year)
- App created in App Store Connect
- GitHub repository with Actions enabled
- Neon Postgres + Electric Cloud (already configured)
- Railway web app deployed (for WriteBuffer API)

---

## One-Time Setup

### 1. Create App in App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Apps → Add App
   - Platform: iOS
   - Name: DeepRecall
   - Bundle ID: `com.renlephy.deeprecall`
   - SKU: `deeprecall`
   - User Access: Full Access

### 2. Generate App Store Connect API Key

1. App Store Connect → Users and Access → Keys (API section)
2. Generate API Key:
   - Name: "GitHub Actions"
   - Access: App Manager
   - Download key file: `AuthKey_XXXXXXXX.p8`
3. Save:
   - Key ID (e.g., `8BX924ZP9N`)
   - Issuer ID (e.g., `393dffb5-5841-42c9-9bfa-01bf12d78c3b`)

### 3. Set Up Code Signing (Fastlane Match)

**Create private certificates repository**:

```bash
# On GitHub, create private repo: DeepRecall-certificates
```

**Initialize Match**:

```bash
cd apps/mobile
bundle install
bundle exec fastlane match init

# Choose: 1 (git)
# Repo URL: git@github.com:RnLe/DeepRecall-certificates.git
```

**Generate certificates**:

```bash
bundle exec fastlane match appstore --app_identifier com.renlephy.deeprecall

# This creates:
# - Apple Distribution certificate
# - App Store provisioning profile
# - Encrypted and stored in your certificates repo
# - Prompts for passphrase (save this!)
```

### 4. Configure GitHub Secrets

Go to: https://github.com/RnLe/DeepRecall/settings/secrets/actions

Add these secrets:

**App Environment**:

```bash
VITE_ELECTRIC_URL=https://deeprecall-production.up.railway.app/api/electric/v1/shape
VITE_ELECTRIC_SOURCE_ID=7efa2a2d-20ad-472b-b2bd-4a6110c26d5c
VITE_ELECTRIC_SOURCE_SECRET=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
VITE_API_BASE_URL=https://deeprecall-production.up.railway.app
```

> Keep the `/api/electric/v1/shape` suffix so the mobile client always talks to the backend proxy.

**Apple Credentials**:

```bash
ASC_KEY_ID=8BX924ZP9N  # From step 2
ASC_ISSUER_ID=393dffb5-5841-42c9-9bfa-01bf12d78c3b  # From step 2
ASC_KEY_CONTENT=<base64 encoded .p8 file>  # Run: base64 -w0 AuthKey_*.p8
```

**Code Signing**:

```bash
P12_PASSWORD=<your certificate password from Match>

# Generate SSH key for certificates repo access
ssh-keygen -t ed25519 -C "gh-actions" -f ~/.ssh/match_key
# Add public key (~/.ssh/match_key.pub) to DeepRecall-certificates repo as deploy key
MATCH_GIT_SSH_PRIVATE_KEY=<contents of ~/.ssh/match_key>
```

---

## GitHub Actions Workflow

The workflow is defined in `.github/workflows/ios-testflight.yml`:

**Trigger**: Manual (workflow_dispatch)

**Steps**:

1. Checkout code
2. Install pnpm + Node.js
3. Build shared packages (`@deeprecall/core`, `@deeprecall/data`, etc.)
4. Build mobile web assets with production env vars
5. Sync Capacitor to iOS project
6. Install CocoaPods dependencies
7. Set up code signing (Match certificates)
8. Build & archive iOS app
9. Upload to TestFlight

---

## Deploying

### Manual Deploy (Recommended)

1. Go to: https://github.com/RnLe/DeepRecall/actions
2. Select "iOS → TestFlight" workflow
3. Click "Run workflow" → Run
4. Wait ~15 minutes
5. Check TestFlight app on iOS device for new build

### Automatic Deploy (Optional)

To auto-deploy on push to `main`, update `.github/workflows/ios-testflight.yml`:

```yaml
on:
  push:
    branches: [main]
    paths:
      - "apps/mobile/**"
      - "packages/**"
  workflow_dispatch: # Keep manual trigger
```

---

## Build Configuration

### Version Numbering

**Update before each deploy**:

**File**: `apps/mobile/ios/App/App.xcodeproj/project.pbxproj`

```xml
MARKETING_VERSION = 1.0.0;  <!-- User-facing version -->
CURRENT_PROJECT_VERSION = 1;  <!-- Build number, must increment -->
```

Or use Xcode:

1. Open `apps/mobile/ios/App/App.xcworkspace`
2. Select App target → General
3. Update Version and Build

**Important**: Build number must be unique and increment (TestFlight rejects duplicates)

---

### Environment Variables

Production env vars are **bundled at build time** via GitHub Actions:

```yaml
# .github/workflows/ios-testflight.yml
env:
  VITE_ELECTRIC_URL: ${{ secrets.VITE_ELECTRIC_URL }}
  VITE_ELECTRIC_SOURCE_ID: ${{ secrets.VITE_ELECTRIC_SOURCE_ID }}
  VITE_ELECTRIC_SOURCE_SECRET: ${{ secrets.VITE_ELECTRIC_SOURCE_SECRET }}
  VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
  VITE_BLOB_STORAGE_MODE: native
```

**Vite bundles these into JavaScript** - no runtime config needed.

---

## Testing Before Deploy

### Local iOS Simulator

```bash
cd apps/mobile

# Create production env file
cp .env.production.example .env.production
# Fill in production values

# Build
pnpm run build:ios

# Sync & run
npx cap sync ios
npx cap open ios

# In Xcode:
# - Select iPhone simulator
# - Press Run (Cmd+R)
```

**Test checklist**:

- ✅ App launches without crashes
- ✅ Electric sync working (check logs)
- ✅ Can create/edit works, annotations
- ✅ File upload works (test with PDF)
- ✅ OAuth sign-in works (if configured)
- ✅ Offline mode: create data, verify it queues in WriteBuffer

---

## TestFlight Beta Testing

### Invite Testers

1. App Store Connect → TestFlight
2. Select "DeepRecall" app
3. Add internal testers (up to 100 free)
4. Or add external testers (requires Apple review for first build)

**Internal Testers**: Immediate access, no Apple review  
**External Testers**: Requires Apple review (~24 hours), up to 10,000 testers

### Provide Test Instructions

Add to TestFlight "What to Test" notes:

```
DeepRecall Beta v1.0.0 (Build 1)

NEW FEATURES:
- PDF library management
- Real-time annotation sync
- Offline-first editing

KNOWN ISSUES:
- [List any known bugs]

TESTING FOCUS:
- Import PDFs and verify they appear in library
- Create annotations, check sync across devices
- Test offline: enable airplane mode, create annotation, re-enable network
- Report crashes via TestFlight feedback button

CREDENTIALS:
- Test account: test@example.com / password123
- Or use "Continue as Guest" for offline testing
```

---

## Monitoring

### GitHub Actions Logs

View build logs:

1. GitHub → Actions → Select workflow run
2. Expand steps to see detailed output
3. Look for:
   - Build errors: Check "Fastlane beta" step
   - Certificate errors: Check "Install certificates" step
   - Upload errors: Check upload to TestFlight step

### TestFlight Crashes

1. App Store Connect → TestFlight → App → Crashes
2. View crash logs and stack traces
3. Download `.crash` files for local symbolication

**Note**: Crash symbolication requires `.dSYM` files (auto-uploaded by Fastlane)

---

## Troubleshooting

### Build Fails: "No matching provisioning profiles found"

**Cause**: Code signing issue

**Fix**:

```bash
# Regenerate certificates
cd apps/mobile
bundle exec fastlane match nuke distribution
bundle exec fastlane match appstore --app_identifier com.renlephy.deeprecall
```

Then update `P12_PASSWORD` secret in GitHub.

---

### Build Fails: "Bundle version already used"

**Cause**: Build number not incremented

**Fix**: Update `CURRENT_PROJECT_VERSION` in Xcode (must be unique)

---

### Upload Fails: "Authentication failed"

**Cause**: Incorrect App Store Connect API key

**Fix**: Verify GitHub secrets:

1. `ASC_KEY_ID` matches key from App Store Connect
2. `ASC_ISSUER_ID` matches your account
3. `ASC_KEY_CONTENT` is valid base64 of `.p8` file

**Re-encode .p8**:

```bash
base64 -w0 AuthKey_*.p8 > key.txt
# Copy contents of key.txt to ASC_KEY_CONTENT secret
```

---

### App crashes on launch

**Cause**: Environment variable missing or invalid

**Fix**:

1. Check GitHub Actions logs for build warnings
2. Verify all `VITE_*` secrets are set correctly
3. Test locally with same env vars before deploying

---

### Electric sync not working in production

**Symptoms**: Mobile app doesn't receive real-time updates

**Checklist**:

1. Verify `VITE_ELECTRIC_*` secrets match production Electric Cloud source
2. Check Electric Cloud dashboard - source should be "Active"
3. Verify Neon Postgres connection in Electric dashboard
4. Check mobile logs: Electric should log connection status

---

### WriteBuffer not flushing

**Symptoms**: Mobile changes don't sync to Postgres

**Checklist**:

1. Verify `VITE_API_BASE_URL` points to correct Railway URL (with `https://`)
2. Check Railway logs for `/api/writes/batch` requests
3. Verify mobile has network connectivity (not in airplane mode)
4. Check mobile logs for WriteBuffer flush errors

---

## Advanced Configuration

### Custom Domain for API

If using custom domain for Railway:

1. Railway → Project → Settings → Custom Domain
2. Add domain (e.g., `api.deeprecall.com`)
3. Update GitHub secret: `VITE_API_BASE_URL=https://api.deeprecall.com`
4. Redeploy mobile app

### Push Notifications (Future)

To add push notifications:

1. Enable in Apple Developer Portal
2. Generate APNs certificate
3. Configure in `Info.plist`
4. Update GitHub Actions to include push entitlements

---

## App Store Submission

When ready for production (not TestFlight):

### 1. Prepare App Store Listing

1. App Store Connect → DeepRecall → App Store
2. Add:
   - Screenshots (iPhone, iPad)
   - App description
   - Keywords
   - Privacy policy URL
   - Support URL

### 2. Submit for Review

1. Select build from TestFlight
2. Fill in "What's New" (release notes)
3. Submit for Review
4. Review time: ~24-48 hours

### 3. Release Options

- **Manual**: Approve release after approval
- **Automatic**: Auto-release on approval
- **Scheduled**: Release on specific date

---

## Related Guides

- **Main Deployment Guide**: [GUIDE_DEPLOYMENT.md](./GUIDE_DEPLOYMENT.md)
- **Web Deployment**: [GUIDE_DEPLOY_WEB.md](./GUIDE_DEPLOY_WEB.md)
- **Mobile Platform**: [GUIDE_MOBILE.md](../ARCHITECTURE/GUIDE_MOBILE.md)
- **Mobile Authentication**: [GUIDE_AUTH_MOBILE.md](../AUTH/GUIDE_AUTH_MOBILE.md)
