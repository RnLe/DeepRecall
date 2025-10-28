# iOS TestFlight Automation Setup Guide

This guide walks you through setting up fully automated iOS builds from GitHub Actions → TestFlight.

## ✅ What's Already Done

- **Fastlane configuration** (`apps/mobile/fastlane/Fastfile`)
- **GitHub Actions workflow** (`.github/workflows/ios-testflight.yml`)
- **App Store Connect API key** (AuthKey_8BX924ZP9N.p8)
- **App Store Connect credentials**:
  - Issuer ID: `393dffb5-5841-42c9-9bfa-01bf12d78c3b`
  - Key ID: `8BX924ZP9N`
  - Apple ID: `6754611356`
  - Bundle ID: `com.renlehpy.deeprecall`
  - SKU: `deeprecall`

## 🔧 Required Setup Steps

### 1. Set Up Fastlane Match (Code Signing)

Fastlane Match stores your signing certificates and provisioning profiles in a private encrypted Git repository.

**Create a private repository:**

```bash
# On GitHub, create a new private repo called "DeepRecall-certificates"
# Don't initialize it with README or .gitignore
```

**Initialize Match locally:**

```bash
cd apps/mobile
bundle install
bundle exec fastlane match init

# When prompted:
# 1. Choose "git" as storage mode
# 2. Enter your repo URL: git@github.com:RnLe/DeepRecall-certificates.git
```

**Generate certificates and profiles:**

```bash
bundle exec fastlane match appstore --app_identifier com.renlehpy.deeprecall

# This will:
# - Create an Apple Distribution certificate
# - Create an App Store provisioning profile
# - Encrypt and store them in your certificates repo
# - You'll be prompted to create a passphrase (save it for GitHub Secrets)
```

### 2. Add GitHub Secrets

Go to **Settings → Secrets and variables → Actions** in your GitHub repository and add:

| Secret Name                 | Value                                             | How to Get It                                       |
| --------------------------- | ------------------------------------------------- | --------------------------------------------------- |
| `ASC_KEY_ID`                | `8BX924ZP9N`                                      | Already have it ✓                                   |
| `ASC_ISSUER_ID`             | `393dffb5-5841-42c9-9bfa-01bf12d78c3b`            | Already have it ✓                                   |
| `ASC_KEY_CONTENT`           | Base64 of AuthKey                                 | Run: `base64 -w0 apps/mobile/AuthKey_8BX924ZP9N.p8` |
| `MATCH_GIT_URL`             | `git@github.com:RnLe/DeepRecall-certificates.git` | Your Match repo URL                                 |
| `MATCH_PASSWORD`            | `your_passphrase`                                 | The passphrase from Match setup                     |
| `MATCH_GIT_SSH_PRIVATE_KEY` | SSH deploy key                                    | See below ↓                                         |

**To create the SSH deploy key for Match:**

```bash
# Generate a new SSH key (no passphrase)
ssh-keygen -t ed25519 -C "github-actions-match" -f ~/.ssh/match_deploy_key

# Add the PUBLIC key to your certificates repo:
# Go to: DeepRecall-certificates → Settings → Deploy keys → Add deploy key
# Paste contents of: ~/.ssh/match_deploy_key.pub
# ✓ Check "Allow write access"

# Add the PRIVATE key to GitHub Secrets:
# Copy contents of: ~/.ssh/match_deploy_key
# Paste into: MATCH_GIT_SSH_PRIVATE_KEY secret
```

### 3. Verify Xcode Configuration

Open `apps/mobile/ios/App/App.xcworkspace` in Xcode and check:

- **Bundle Identifier**: Must be exactly `com.renlehpy.deeprecall`
- **Team**: Select your Apple Developer team
- **Signing**: Can use "Automatically manage signing" (Fastlane will override)
- **Version**: Set initial version (e.g., `1.0.0`)
- **Build**: Set initial build number (e.g., `1`)

### 4. Test Locally

Before pushing to CI, test the Fastlane lane locally:

```bash
cd apps/mobile

# Make sure you have the API key
export ASC_KEY_ID="8BX924ZP9N"
export ASC_ISSUER_ID="393dffb5-5841-42c9-9bfa-01bf12d78c3b"
export ASC_KEY_CONTENT=$(base64 -w0 AuthKey_8BX924ZP9N.p8)
export MATCH_GIT_URL="git@github.com:RnLe/DeepRecall-certificates.git"
export MATCH_PASSWORD="your_passphrase"

# Test the build (this will upload to TestFlight!)
bundle exec fastlane ios beta
```

### 5. Trigger the GitHub Actions Workflow

Once everything is configured:

**Option A: Push to main branch**

```bash
git add .
git commit -m "feat: add iOS TestFlight automation"
git push origin main
```

**Option B: Manual trigger**

- Go to **Actions** tab in GitHub
- Select "iOS → TestFlight" workflow
- Click "Run workflow"

## 📱 TestFlight Access

After a successful build:

1. **Internal Testing** (instant, no review):
   - Go to App Store Connect → TestFlight
   - Add internal testers (up to 100)
   - They'll receive an email and can install via TestFlight app

2. **External Testing** (requires beta review):
   - Create external groups in TestFlight
   - Submit for beta app review (usually 24-48 hours)
   - Update Fastfile: `distribute_external: true`

## 🔍 Troubleshooting

### Build fails with "No profiles matching"

- Run `bundle exec fastlane match appstore` again
- Check that Bundle ID matches exactly

### "Authentication failed"

- Verify ASC_KEY_CONTENT is properly base64-encoded
- Check that Key ID and Issuer ID are correct

### SSH key issues with Match repo

- Ensure deploy key has write access
- Test SSH: `ssh -T git@github.com`

### CocoaPods fails

- Delete `apps/mobile/ios/App/Pods` and `Podfile.lock`
- Run `cd apps/mobile/ios/App && pod install`

## 🚀 Next Steps

Once automated builds are working:

- [ ] Set up external TestFlight testing
- [ ] Configure automatic build versioning (from git tags)
- [ ] Add screenshot generation with Fastlane Snapshot
- [ ] Set up App Store release automation

## 📚 References

- [Fastlane Match Docs](https://docs.fastlane.tools/actions/match/)
- [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi)
- [GitHub Actions for iOS](https://docs.github.com/en/actions/deployment/deploying-xcode-applications/installing-an-apple-certificate-on-macos-runners-for-xcode-development)
