# Desktop Deployment Guide (Tauri)

**Platform**: Tauri (Windows/macOS/Linux) 
**Deploy Method**: Manual builds + distribution 
**Build Time**: ~10 minutes

This guide covers building and distributing the DeepRecall desktop app.

---

## Prerequisites

- Rust toolchain installed
- Platform-specific build tools:
 - **Windows**: Visual Studio Build Tools
 - **macOS**: Xcode Command Line Tools
 - **Linux**: build-essential, libssl-dev, libgtk-3-dev
- Code signing certificate (for distribution)

---

## Development Build

### Local Testing

```bash
cd apps/desktop

# Create .env.local from example
cp .env.example .env.local
# Fill in your credentials

# Run in development mode
pnpm tauri dev
```

**Dev mode features**:

- Hot reload for TypeScript/React
- Rust rebuilds on changes to `src-tauri/`
- DevTools accessible (F12)
- Logs to terminal

---

## Production Build

### 1. Prepare Environment

**Create production `.env.local`** (desktop builds embed these values—no runtime override):

```bash
# apps/desktop/.env.local (production values)

# PostgreSQL Direct Connection
VITE_POSTGRES_HOST=ep-late-cell-ag9og5sf.c-2.eu-central-1.aws.neon.tech
VITE_POSTGRES_PORT=5432
VITE_POSTGRES_DB=neondb
VITE_POSTGRES_USER=neondb_owner
VITE_POSTGRES_PASSWORD=<your-password>
VITE_POSTGRES_SSL=require

# Electric Cloud Sync (proxied)
VITE_ELECTRIC_URL=https://deeprecall-production.up.railway.app/api/electric/v1/shape
VITE_ELECTRIC_SOURCE_ID=7efa2a2d-20ad-472b-b2bd-4a6110c26d5c
VITE_ELECTRIC_SOURCE_SECRET=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

# OAuth (Required for desktop sign-in)
VITE_API_URL=https://deeprecall-production.up.railway.app
VITE_GOOGLE_DESKTOP_CLIENT_ID=<your-google-desktop-client-id>
VITE_GOOGLE_DESKTOP_CLIENT_SECRET=<your-google-desktop-secret>
VITE_GITHUB_DESKTOP_CLIENT_ID=<your-github-desktop-client-id>
```

**Important**: `.env.local` is **embedded at build time** via `build.rs`. Credentials are baked into the executable, and the Electric proxy path must include `/api/electric/v1/shape` so sync calls stay behind the Next.js API.

---

### 2. Build for Your Platform

#### Windows

```bash
cd apps/desktop
pnpm tauri build

# Output:
# src-tauri/target/release/DeepRecall.exe
# src-tauri/target/release/bundle/msi/DeepRecall_1.0.0_x64_en-US.msi
# src-tauri/target/release/bundle/nsis/DeepRecall_1.0.0_x64-setup.exe
```

#### macOS

```bash
cd apps/desktop
pnpm tauri build

# Output:
# src-tauri/target/release/bundle/macos/DeepRecall.app
# src-tauri/target/release/bundle/dmg/DeepRecall_1.0.0_x64.dmg
```

#### Linux

```bash
cd apps/desktop
pnpm tauri build

# Output:
# src-tauri/target/release/DeepRecall
# src-tauri/target/release/bundle/deb/deep-recall_1.0.0_amd64.deb
# src-tauri/target/release/bundle/appimage/deep-recall_1.0.0_amd64.AppImage
```

---

### 3. Cross-Platform Builds

#### Build Windows from Linux (WSL2)

```bash
# Install mingw-w64
sudo apt install mingw-w64

# Add Windows target
rustup target add x86_64-pc-windows-gnu

# Build
cd apps/desktop
pnpm tauri build --target x86_64-pc-windows-gnu

# Output: src-tauri/target/x86_64-pc-windows-gnu/release/DeepRecall.exe
```

**Note**: Cross-compilation has limitations (no installer bundles, manual signing required)

---

## Code Signing

### Windows (Authenticode)

**Prerequisites**:

- Code signing certificate (.pfx file)
- Certificate password

**Configure Tauri**:

```toml
# apps/desktop/src-tauri/tauri.conf.json
{
 "bundle": {
 "windows": {
 "certificateThumbprint": null,
 "digestAlgorithm": "sha256",
 "timestampUrl": "http://timestamp.digicert.com",
 "signCommand": {
 "cmd": "signtool",
 "args": [
 "sign",
 "/f", "path/to/certificate.pfx",
 "/p", "%CERT_PASSWORD%",
 "/fd", "sha256",
 "/tr", "http://timestamp.digicert.com",
 "/td", "sha256",
 "%1"
 ]
 }
 }
 }
}
```

**Build with signing**:

```bash
set CERT_PASSWORD=your-cert-password
pnpm tauri build
```

---

### macOS (Apple Developer)

**Prerequisites**:

- Apple Developer account
- Developer ID Application certificate

**Configure Tauri**:

```toml
# apps/desktop/src-tauri/tauri.conf.json
{
 "bundle": {
 "macOS": {
 "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)",
 "entitlements": null,
 "exceptionDomain": null,
 "hardenedRuntime": true,
 "providerShortName": null
 }
 }
}
```

**Build with signing**:

```bash
pnpm tauri build
```

**Notarize** (required for macOS Gatekeeper):

```bash
xcrun notarytool submit \
 src-tauri/target/release/bundle/dmg/DeepRecall_1.0.0_x64.dmg \
 --apple-id your@email.com \
 --team-id YOUR_TEAM_ID \
 --password app-specific-password
```

---

### Linux (No signing required)

Linux doesn't require code signing, but you can sign with GPG for verification:

```bash
gpg --armor --detach-sign DeepRecall_1.0.0_amd64.deb
```

---

## Distribution

### Manual Distribution

**Upload installers** to:

- GitHub Releases
- Website download page
- Cloud storage (S3, Dropbox, etc.)

**Example GitHub Release**:

```bash
# Create release
gh release create v1.0.0 \
 --title "DeepRecall v1.0.0" \
 --notes "Release notes here"

# Upload binaries
gh release upload v1.0.0 \
 src-tauri/target/release/bundle/msi/DeepRecall_1.0.0_x64_en-US.msi \
 src-tauri/target/release/bundle/dmg/DeepRecall_1.0.0_x64.dmg \
 src-tauri/target/release/bundle/deb/deep-recall_1.0.0_amd64.deb
```

---

### Auto-Update (Future)

Tauri supports auto-updates via `tauri-updater`:

**Setup**:

1. Configure update endpoints in `tauri.conf.json`
2. Host update manifests (JSON with latest version info)
3. Sign updates with private key
4. App checks for updates on launch

**Not yet implemented** - manual updates only for now.

---

## Version Numbering

**Update before each release**:

**File**: `apps/desktop/src-tauri/tauri.conf.json`

```json
{
 "version": "1.0.0"
}
```

**File**: `apps/desktop/src-tauri/Cargo.toml`

```toml
[package]
version = "1.0.0"
```

**Important**: Keep versions in sync between files.

---

## Build Configuration

### Tauri Configuration

**File**: `apps/desktop/src-tauri/tauri.conf.json`

Key settings:

```json
{
 "productName": "DeepRecall",
 "version": "1.0.0",
 "identifier": "com.renlephy.deeprecall",
 "build": {
 "beforeDevCommand": "pnpm dev",
 "beforeBuildCommand": "pnpm build",
 "devUrl": "http://localhost:5173",
 "frontendDist": "../dist"
 },
 "bundle": {
 "icon": [
 "icons/32x32.png",
 "icons/128x128.png",
 "icons/icon.icns",
 "icons/icon.ico"
 ]
 }
}
```

---

### Environment Embedding

**File**: `apps/desktop/src-tauri/build.rs`

```rust
// Reads .env.local at compile time
// Emits as Rust env vars
fn main() {
 if let Ok(entries) = dotenvy::from_filename(".env.local") {
 for (key, value) in entries {
 println!("cargo:rustc-env={}={}", key, value);
 }
 }
 tauri_build::build()
}
```

**Result**: All `VITE_*` vars become Rust `env!()` macros.

---

## Testing Before Release

### Full Test Checklist

```bash
cd apps/desktop

# 1. Clean build
pnpm tauri build

# 2. Install/run the built app
# Windows: Run .msi installer
# macOS: Open .dmg and drag to Applications
# Linux: Install .deb or run .AppImage

# 3. Test functionality
# ✅ App launches without errors
# ✅ Postgres connection working (check logs)
# ✅ Electric sync working (data syncs)
# ✅ Blob storage working (can import PDFs)
# ✅ OAuth sign-in working (if configured)
# ✅ Offline mode: disconnect network, create annotation, reconnect
# ✅ Multi-device sync: create data, verify on web/mobile

# 4. Check logs
# Windows: %LOCALAPPDATA%\DeepRecall\deeprecall.log
# macOS: ~/Library/Application Support/DeepRecall/deeprecall.log
# Linux: ~/.config/DeepRecall/deeprecall.log
```

---

## Troubleshooting

### Build Fails: "Postgres SSL error"

**Cause**: Missing SSL support in Rust Postgres client

**Fix**: Verify `Cargo.toml` includes:

```toml
[dependencies]
tokio-postgres = { version = "0.7", features = ["with-serde_json-1"] }
tokio-postgres-rustls = "0.12"
```

---

### Build Fails: "Command 'pnpm' not found"

**Cause**: Tauri can't find pnpm

**Fix**: Install pnpm globally or use npm:

```bash
npm install -g pnpm
# Or update tauri.conf.json to use npm
```

---

### App crashes on launch

**Cause**: Missing or invalid environment variables

**Fix**:

1. Check `.env.local` exists in `apps/desktop/`
2. Verify all required `VITE_*` vars are set
3. Rebuild after env changes (build.rs only runs at compile time)

---

### Electric sync not working

**Symptoms**: Desktop app doesn't receive updates

**Checklist**:

1. Verify `VITE_ELECTRIC_*` vars in `.env.local`
2. Check Electric Cloud dashboard - source "Active"
3. Check logs for Electric connection errors
4. Verify network connectivity (firewall blocking?)

---

### Postgres writes failing

**Symptoms**: Desktop changes don't save to database

**Checklist**:

1. Verify `VITE_POSTGRES_*` vars are correct
2. Check Neon Postgres allows connections from your IP
3. Verify SSL mode is `require` (Neon requirement)
4. Check logs for Postgres connection errors

---

## Performance Optimization

### Reduce Bundle Size

**Enable LTO (Link-Time Optimization)**:

```toml
# apps/desktop/src-tauri/Cargo.toml
[profile.release]
lto = true
codegen-units = 1
strip = true
```

**Trade-off**: Longer build time, smaller binary (~30% reduction)

---

### Faster Startup

**Lazy-load PDF.js worker**:

```typescript
// Only load when needed (first PDF opened)
const loadPdfWorker = async () => {
 await import("@deeprecall/pdf");
};
```

---

## Related Guides

- **Main Deployment Guide**: [GUIDE_DEPLOYMENT.md](./GUIDE_DEPLOYMENT.md)
- **Web Deployment**: [GUIDE_DEPLOY_WEB.md](./GUIDE_DEPLOY_WEB.md)
- **Mobile Deployment**: [GUIDE_DEPLOY_MOBILE.md](./GUIDE_DEPLOY_MOBILE.md)
- **Desktop Platform**: [GUIDE_DESKTOP.md](../ARCHITECTURE/GUIDE_DESKTOP.md)
- **Desktop Authentication**: [GUIDE_AUTH_DESKTOP.md](../AUTH/GUIDE_AUTH_DESKTOP.md)
