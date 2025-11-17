# GUIDE: Guest ↔ User Sign-In

## Core Responsibilities

- `AuthStateManager` (apps/\*/providers.tsx) runs on session changes, calls `handleSignIn`/`handleSignOut` and renders `SyncManager` once per auth state.
- `SyncManager` subscribes Electric shapes only when `userId` is set; `ConditionalSyncManager` keeps blob coordination hooks running for guests when required.
- `BlobCAS` adapters (web/desktop/mobile) provide `has/stat/list/scan` for both guest and user flows; Web adapter caches `/api/library/blobs` responses for 5s to avoid duplicate fetches.
- Global auth state (`setAuthState`, `isAuthenticated`) gates WriteBuffer enqueue, Electric filters (`owner_id`), and server API calls.

## Startup States

- **Cold start**: `setAuthState(false)` → guest mode; Dexie tables cleared except local guest data.
- **Auth session detected**: `handleSignIn` runs before `setAuthState(true, userId, deviceId)` so that guest upgrades/wipes complete before sync/UI renders user data.
- **Offline authenticated session**: cached session keeps `userId`; Electric subscriptions stay filtered but idle, WriteBuffer queues changes offline.

## Sign-In Flow (`handleSignIn`)

1. **Detect guest data**: `hasGuestData(deviceId)` checks Dexie local tables + CAS pending entries. If none, exit (action `"none"`).
2. **Account probe**: `isNewAccount(userId, apiBaseUrl)` hits `/api/user/status` to decide upgrade vs wipe.
3. **Upgrade branch (new account)**:
   - `upgradeGuestToUser(userId, deviceId, blobStorage, apiBaseUrl)` relabels local rows, uploads blobs via WriteBuffer, enforces 1:1 asset creation, and coordinates CAS metadata.
   - Returns counts for logging and telemetry; `AuthStateManager` proceeds to set auth state after success.
4. **Wipe branch (existing account)**:
   - `wipeGuestData()` clears all `*_local` tables plus guest CAS metadata.
   - `setAuthState(true, userId, deviceId)` immediately so subsequent CAS coordination uses authenticated pathways.
   - Poll Dexie (`db.blobsMeta`, `db.deviceBlobs`) for Electric-sync confirmation (50 attempts ×100 ms, with 200 ms settle) to avoid duplicate CAS records.
   - `coordinateAllLocalBlobs(blobStorage, deviceId, userId)` rescans local files, recreates device_blobs rows, and enforces asset presence without reuploading duplicates.
5. **Result contract**: `SignInResult` exposes `action`, `success`, and optional `details` for UI toasts/logs. Callers must not mutate auth state until success.

## Sign-Out Flow (`handleSignOut`)

1. Clear WriteBuffer (`getFlushWorker().getBuffer().clear()`) to prevent stale authenticated changes from retrying.
2. `db.blobsMeta/deviceBlobs/replicationJobs.clear()` to drop server metadata and avoid leaking user info into guest mode.
3. `scanAndCheckCAS(blobStorage, deviceId)` performs guest CAS inventory plus integrity check so missing files are surfaced immediately.
4. Invalidate UI caches (React Query) when running in browser (`window.__queryClient`).
5. Providers clear `setAuthState(false)` and re-enable guest-only experiences.

## Guest vs User Rules

- Guest mode never enqueues WriteBuffer or calls server APIs that require auth; `isAuthenticated()` guards every write path and CAS sync endpoint.
- Authenticated mode always runs `SyncManager` (all `use*Sync` hooks) exactly once; guest mode only runs `ConditionalSyncManager` hooks that keep CAS metadata accurate.
- Device ID is stable across modes; it labels `device_blobs` rows and is stored in local storage / secure storage per platform.
- Never mix guest + user data inside Dexie: upgrade flow relabels rows, wipe flow deletes them.

## Method Ordering (per platform)

1. Session provider detects auth event (NextAuth/Tauri/Capacitor) and fetches session token.
2. Call `handleSignIn(userId, deviceId, blobStorage, apiBaseUrl)`.
3. On success, call `setAuthState(true, userId, deviceId)` and render `SyncManager`.
4. On failure, keep guest mode and surface error.
5. On sign-out request, call `handleSignOut(deviceId, blobStorage)` then `setAuthState(false)` and stop SyncManager.

## Platform Notes

- **Web**: `WebBlobStorage` wraps `/api/library/*`; `.list()` caching (5 s TTL, shared promise) prevents redundant network spikes when `useOrphanedBlobs`/`useOrphanedAssets` refetch during auth transitions.
- **Desktop**: Tauri CAS commands reuse same flow; ensure secure storage session is read before invoking `handleSignIn` to avoid treating authenticated restarts as guests.
- **Mobile**: Capacitor SecureStorage maintains session; background/foreground transitions must avoid re-running `handleSignIn` unless session actually changes.

## Monitoring

- Telemetry channel `auth` logs every branch with truncated IDs; look for `Starting sign-in flow`, `Guest data UPGRADED`, `Guest data WIPED`, `CAS rescan complete` to trace issues.
- Poll loop timeout during Electric sync logs a warning but proceeds; investigate Electric connectivity if repeated.
- CAS stats (`coordinated`, `skipped`) confirm duplicate suppression after wipes.

## Troubleshooting Notes (Nov 2025)

- **Partial asset updates can strand guest data.** When a guest-created asset is relinked right after sign-in, Postgres may not have a row yet (RLS hides the insert), so an `update` WriteBuffer entry falls back to `insert`. If the payload only includes `workId`/`filename`, schema validation fails and the change loops forever as “pending”. Always include the full asset shape (`kind`, `sha256`, `bytes`, `mime`, timestamps, etc.) whenever we reuse an existing asset ID. See `packages/ui/src/library/LinkBlobDialog.tsx` for the normalized payload helper.
- **Detach before delete must send `workId: null`.** When removing a work we optimistically clear its assets via `updateAssetLocal`. Passing `undefined` slips through Dexie and only updates `updatedAt`, so the writebuffer change never reconciles. Explicitly send SQL `NULL` (e.g. `workId: null as unknown as string | undefined`) so Postgres sees the update and Electric can confirm cleanup. The shared schema (`packages/core/src/schemas/library.ts`) now allows `workId` to be nullable so these updates validate server-side. Relying solely on `ON DELETE SET NULL` leaves a stuck local record.
- **Symptom to watch:** Link/unlink succeeds locally but Electric never delivers the delta after auth; WriteBuffer shows “applied” yet Postgres row is missing. Check logs for repeated `assets` update retries and confirm the payload isn’t truncated.
- **Mitigation:** After guest→user upgrade (or any auth toggle), prefer rebuilding stale rows via full-payload updates or rerunning `upgradeGuestToUser` so that every asset has a server-side owner before we start issuing partial updates.

## Reference Files

- `packages/data/src/auth/flows.ts` — `handleSignIn`, `handleSignOut`, `debugAccountStatus`.
- `packages/data/src/auth/upgradeGuest.ts` — upgrade mechanics and WriteBuffer usage.
- `packages/data/src/auth/accountStatus.ts` — `isNewAccount`, `wipeGuestData` helpers.
- `packages/data/src/utils/coordinateLocalBlobs.ts` — CAS rescan + asset enforcement.
- `apps/*/app/providers.tsx` — `AuthStateManager`, `SyncManager`, platform wiring.
- `apps/*/src/blob-storage/*.ts` — platform CAS adapters (Web caching change lives here).
