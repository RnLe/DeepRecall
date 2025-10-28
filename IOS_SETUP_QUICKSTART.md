# Quick Start: iOS TestFlight Setup (Linux)

## 📋 Prerequisites

- [x] Apple Developer Account
- [x] App created in App Store Connect
- [x] `DeepRecall-certificates` GitHub repo created
- [x] Fastlane installed locally

## 🚀 Quick Steps

### 1. Generate Certificate (5 min)

```bash
cd apps/mobile/certificates
./generate-csr.sh
# Follow prompts, then upload distribution.csr to Apple
```

**Upload CSR:**
https://developer.apple.com/account/resources/certificates/add
→ Apple Distribution → Upload `distribution.csr` → Download `distribution.cer`

### 2. Convert Certificate (1 min)

```bash
./convert-to-p12.sh
# Save the password!
```

### 3. Create Provisioning Profile (3 min)

https://developer.apple.com/account/resources/profiles/add
→ App Store → `com.renlehpy.deeprecall` → Download profile

### 4. Import to Match (2 min)

```bash
cd ..
bundle exec fastlane match init
# Select: 1 (git)
# URL: git@github.com:RnLe/DeepRecall-certificates.git

export MATCH_GIT_URL="git@github.com:RnLe/DeepRecall-certificates.git"
export MATCH_PASSWORD="your_new_passphrase"

bundle exec fastlane match import \
  --type appstore \
  --app_identifier com.renlehpy.deeprecall \
  --cert_path certificates/distribution.p12 \
  --p12_password "your_p12_password" \
  --profile_path certificates/DeepRecall_App_Store.mobileprovision
```

### 5. GitHub Secrets (3 min)

https://github.com/RnLe/DeepRecall/settings/secrets/actions

```bash
# Get ASC_KEY_CONTENT
base64 -w0 AuthKey_8BX924ZP9N.p8

# Generate SSH key for Match repo
ssh-keygen -t ed25519 -C "gh-actions" -f ~/.ssh/match_key
cat ~/.ssh/match_key.pub  # Add to certificates repo as deploy key
cat ~/.ssh/match_key      # Add to MATCH_GIT_SSH_PRIVATE_KEY
```

Add 6 secrets:

- `ASC_KEY_ID` = `8BX924ZP9N`
- `ASC_ISSUER_ID` = `393dffb5-5841-42c9-9bfa-01bf12d78c3b`
- `ASC_KEY_CONTENT` = (from command above)
- `MATCH_GIT_URL` = `git@github.com:RnLe/DeepRecall-certificates.git`
- `MATCH_PASSWORD` = (from step 4)
- `MATCH_GIT_SSH_PRIVATE_KEY` = (from command above)

### 6. Deploy! (1 min)

```bash
cd /home/renlephy/DeepRecall
git add .
git commit -m "feat: iOS TestFlight automation"
git push
```

Go to Actions → "iOS → TestFlight" → Run workflow

---

**Total time: ~15 minutes**

📖 **Full guide:** `apps/mobile/certificates/LINUX_SETUP_GUIDE.md`
