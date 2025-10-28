# iOS Code Signing Setup on Linux (Without a Mac)

Since you don't have access to a Mac, you can still create Apple certificates using OpenSSL on Linux. Here's the complete process:

---

## Part 1: Generate Certificate Signing Request (CSR)

### Step 1: Generate CSR

```bash
cd /home/renlephy/DeepRecall/apps/mobile/certificates
./generate-csr.sh
```

This will prompt you for:

- Email address (your Apple ID email)
- Full name
- Country code (e.g., US, DE, UK)

**Output:**

- `distribution.key` - Your private key (**KEEP SECURE, NEVER COMMIT**)
- `distribution.csr` - Certificate signing request (upload to Apple)

---

## Part 2: Create Apple Distribution Certificate

### Step 2: Upload CSR to Apple

1. Go to: https://developer.apple.com/account/resources/certificates/add
2. Select **"Apple Distribution"**
3. Click **"Continue"**
4. Click **"Choose File"** and upload `distribution.csr`
5. Click **"Continue"**
6. Download the certificate (it will be named something like `distribution.cer`)
7. Save it in the `certificates/` directory

### Step 3: Convert to P12 Format

```bash
cd /home/renlephy/DeepRecall/apps/mobile/certificates
./convert-to-p12.sh
```

This will:

- Convert `distribution.cer` + `distribution.key` → `distribution.p12`
- Prompt you for a password (save this password!)

---

## Part 3: Create Provisioning Profile

You also need an **App Store provisioning profile**.

### Step 4: Create Provisioning Profile

1. Go to: https://developer.apple.com/account/resources/profiles/add
2. Select **"App Store"** under Distribution
3. Click **"Continue"**
4. Select your **App ID**: `com.renlehpy.deeprecall`
   - If it doesn't exist, create it first at: https://developer.apple.com/account/resources/identifiers/add
5. Select the **Distribution certificate** you just created
6. Name it: `DeepRecall App Store`
7. Click **"Generate"**
8. Download the profile (e.g., `DeepRecall_App_Store.mobileprovision`)

---

## Part 4: Set Up Fastlane Match (Manual Mode)

Since Match usually handles certificate creation automatically (requires Mac), we'll set it up manually with the certificates you created.

### Step 5: Initialize Match Repository

```bash
cd /home/renlephy/DeepRecall/apps/mobile
bundle exec fastlane match init
```

- Select: **`1`** (git)
- Enter: `git@github.com:RnLe/DeepRecall-certificates.git`

This creates a `Matchfile`.

### Step 6: Manually Import Certificates to Match

```bash
cd /home/renlephy/DeepRecall/apps/mobile

# Set environment variables
export MATCH_GIT_URL="git@github.com:RnLe/DeepRecall-certificates.git"
export MATCH_PASSWORD="your_chosen_passphrase"  # Create a strong passphrase

# Import the certificate and profile
bundle exec fastlane match import \
  --type appstore \
  --app_identifier com.renlehpy.deeprecall \
  --cert_path certificates/distribution.p12 \
  --p12_password "password_you_set_in_step3" \
  --profile_path certificates/DeepRecall_App_Store.mobileprovision
```

This will:

- Encrypt your certificate and provisioning profile
- Push them to your `DeepRecall-certificates` repo

---

## Part 5: Add GitHub Secrets

Go to: https://github.com/RnLe/DeepRecall/settings/secrets/actions

Add these secrets:

| Secret Name                 | Value                                             | How to Get                              |
| --------------------------- | ------------------------------------------------- | --------------------------------------- |
| `ASC_KEY_ID`                | `8BX924ZP9N`                                      | ✅ You have this                        |
| `ASC_ISSUER_ID`             | `393dffb5-5841-42c9-9bfa-01bf12d78c3b`            | ✅ You have this                        |
| `ASC_KEY_CONTENT`           | (base64 string)                                   | Run: `base64 -w0 AuthKey_8BX924ZP9N.p8` |
| `MATCH_GIT_URL`             | `git@github.com:RnLe/DeepRecall-certificates.git` | ✅ You know this                        |
| `MATCH_PASSWORD`            | (your passphrase)                                 | From Step 6                             |
| `MATCH_GIT_SSH_PRIVATE_KEY` | (SSH private key)                                 | See below ↓                             |

### Create SSH Deploy Key:

```bash
ssh-keygen -t ed25519 -C "github-actions-match" -f ~/.ssh/match_deploy_key
# Press Enter for no passphrase

# Add PUBLIC key to: https://github.com/RnLe/DeepRecall-certificates/settings/keys
cat ~/.ssh/match_deploy_key.pub
# Copy output, add as deploy key with WRITE access

# Add PRIVATE key to GitHub Secrets
cat ~/.ssh/match_deploy_key
# Copy output, add to MATCH_GIT_SSH_PRIVATE_KEY secret
```

---

## Part 6: Test the Pipeline

```bash
cd /home/renlephy/DeepRecall

git add .
git commit -m "feat: add iOS TestFlight automation"
git push origin level2-transformation
```

Then:

1. Go to: https://github.com/RnLe/DeepRecall/actions
2. Select **"iOS → TestFlight"** workflow
3. Click **"Run workflow"**
4. Select your branch
5. Watch the build!

---

## Security Notes

**Never commit these files:**

- `distribution.key` (private key)
- `distribution.p12` (certificate)
- `distribution.csr` (can be deleted after use)
- `*.mobileprovision` (provisioning profiles)

Add to `.gitignore`:

```
apps/mobile/certificates/
!apps/mobile/certificates/*.sh
```

---

## Troubleshooting

**"Certificate not valid"**

- Make sure you selected "Apple Distribution" (not "Development")
- Verify the certificate is active in Apple Developer Portal

**"No matching provisioning profile"**

- Bundle ID must match exactly: `com.renlehpy.deeprecall`
- Profile must be "App Store" type (not "Ad Hoc" or "Development")

**Match import fails**

- Ensure the P12 password is correct
- Check that the provisioning profile matches your certificate

---

## Summary

1. ✅ Generate CSR with `generate-csr.sh`
2. ✅ Upload CSR to Apple → Download `distribution.cer`
3. ✅ Convert with `convert-to-p12.sh`
4. ✅ Create provisioning profile on Apple Developer Portal
5. ✅ Import to Match with `fastlane match import`
6. ✅ Add GitHub Secrets
7. ✅ Push and run workflow

**Total time: ~15 minutes**

Good luck! 🚀
