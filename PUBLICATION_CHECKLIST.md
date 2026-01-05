# DeepRecall — Public Repository Publication Checklist

> **Purpose**: Safely publish this repository to a public audience (e.g., OpenAI Residency application)
>
> **Date Generated**: January 5, 2026
>
> **Status**: 🟡 **ALMOST READY** — Git history cleaned, force push required

---

## Executive Summary

| Category      | Risk Level | Status                                                 |
| ------------- | ---------- | ------------------------------------------------------ |
| Git History   | 🟢 DONE    | Secrets removed via git-filter-repo                    |
| Source Code   | 🟡 MEDIUM  | OAuth client IDs hardcoded (public but identifies you) |
| Documentation | 🟢 DONE    | Placeholders applied by git-filter-repo                |
| .env Files    | 🟢 LOW     | Properly gitignored (not tracked)                      |
| Certificates  | 🟢 LOW     | Properly gitignored (not tracked)                      |

---

## ✅ COMPLETED: Git History Cleanup

The following secrets were removed from all git history:

- [x] Neon database password → replaced with `REDACTED`
- [x] ElectricSQL JWT secret → replaced with `<your-electric-source-secret>`

**Backup location**: `~/DeepRecall-backup-20260105-150456`

---

## 🚀 REMAINING: Force Push to GitHub

Run this command to update GitHub with the cleaned history:

\`\`\`bash
cd /home/renlephy/DeepRecall
git push origin main --force-with-lease
\`\`\`

⚠️ **Warning**: This rewrites remote history. Anyone who cloned the repo will need to re-clone.

---

## 🟡 OPTIONAL: OAuth Client IDs in Source Code

OAuth Client IDs are **public by design** (embedded in apps), but they identify your Google Cloud/GitHub accounts:

| Location                             | Client ID                                       | Type           |
| ------------------------------------ | ----------------------------------------------- | -------------- |
| \`apps/mobile/src/auth/google.ts\`     | \`193717154963-uvolmq1rfotinfg6g9se6p9ae5ur9q09\` | iOS            |
| \`apps/mobile/ios/App/App/Info.plist\` | Same                                            | iOS URL Scheme |
| \`apps/desktop/.env.example\`          | \`193717154963-t1idfsda9tt92ngbm4n9mcvbr73ktbpa\` | Desktop        |
| \`apps/mobile/src/auth/github.ts\`     | \`Ov23lii9PjHnRsAhhP3S\`                          | GitHub Device  |

**Decision**: Keep as-is (normal for OAuth) or replace with placeholders (requires setup instructions).

---

## 🟢 Verified Safe

### Gitignored Files (NOT tracked)

- \`apps/web/.env.local\` ✅
- \`apps/mobile/.env.local\` ✅
- \`apps/desktop/.env.local\` ✅
- \`apps/mobile/AuthKey_*.p8\` ✅
- \`apps/mobile/certificates/*.key|.pem|.p12|.cer|.mobileprovision\` ✅

### External Services (Unaffected by git changes)

- Railway environment variables ✅
- Neon database credentials ✅
- Electric Cloud configuration ✅

---

## Post-Publication Checklist

- [ ] Force push cleaned history to GitHub
- [ ] Make repository public
- [ ] Verify Railway deployment still works
- [ ] (Optional) Add \`CONTRIBUTING.md\` with setup instructions

---

*Cleaned on January 5, 2026 using git-filter-repo*
