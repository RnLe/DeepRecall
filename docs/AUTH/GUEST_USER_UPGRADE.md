# Guest to User Upgrade

## Decision Matrix

| Current State    | Action           | Outcome                      |
| ---------------- | ---------------- | ---------------------------- |
| Guest (no data)  | Sign in (new)    | Start fresh, no upgrade      |
| Guest (no data)  | Sign in (exists) | Start fresh, no upgrade      |
| Guest (has data) | Sign in (new)    | **UPGRADE**: Flush to server |
| Guest (has data) | Sign in (exists) | **WIPE**: Clear local data   |

**Rule**: Only upgrade guest data when signing into a **NEW** account. If user already has server data, **discard** local guest data to prevent conflicts.

## Account Status Detection

**Check**: Query server for user's existing data (works count, etc.)

- Zero rows = NEW account → upgrade guest data
- Has rows = EXISTING account → wipe guest data

**Implementation**:

```typescript
// apps/*/providers.tsx → AuthStateManager
useEffect(() => {
  if (authenticated && !hasUpgradedRef.current) {
    const isNewAccount = await checkAccountIsNew(userId);

    if (hasGuestData() && isNewAccount) {
      await upgradeGuestToUser(userId, deviceId, cas, apiBaseUrl);
    } else if (hasGuestData() && !isNewAccount) {
      await wipeGuestData(); // Discard guest data
    }
  }
}, [authenticated, userId]);
```

## Offline Authentication

**Critical**: Authenticated users stay authenticated offline (never become guests).

**Session Persistence** (Current Implementation):

- Web: NextAuth cookies (httpOnly, secure)
- Desktop: Tauri secure storage
- Mobile: Capacitor SecureStorage

**Offline Write Flow**:

```
User offline → Write to *_local tables → Buffer in WriteBuffer
              ↓
User online  → Flush buffer → Postgres → Electric → Sync back
```

## Platform-Specific Guards

**Electric Shapes** (Already Implemented):

```typescript
useShape({
  where: userId ? `owner_id = '${userId}'` : undefined,
});
```

- Guest: `userId = undefined` → No Electric sync
- User offline: `userId = cached` → Shapes stay filtered, no new data until online

**WriteBuffer Flushing** (Already Implemented):

```typescript
if (isAuthenticated()) {
  await buffer.enqueue(change); // Flushes when online
} else {
  // Guest: local-only, no enqueue
}
```

**API Endpoint Guards**:

```typescript
// Pattern: Skip server calls for guests
async syncBlobToElectric(sha256: string) {
  const { isAuthenticated } = await import("@deeprecall/data");

  if (!isAuthenticated()) {
    return; // Guest: skip server sync
  }

  await fetch("/api/admin/sync-blob", { ... });
}
```

## Edge Cases

| Scenario                                  | Handling                                |
| ----------------------------------------- | --------------------------------------- |
| Sign in fails mid-upgrade                 | Rollback: Keep guest state, retry later |
| User cancels sign-in dialog               | Keep guest mode, no changes             |
| Network drops during flush                | WriteBuffer retries with backoff        |
| User signs in on Device A, then Device B  | Each device upgrades independently      |
| Sign out, then immediately sign in (same) | Wipe guest data (existing account)      |

## Implementation Checklist

**Priority 1 - Account Detection**:

- [ ] Add `/api/user/is-new` endpoint (check works/assets count)
- [ ] Call from `AuthStateManager` before upgrade decision
- [ ] Add `wipeGuestData()` function (clear \*\_local tables only)

**Priority 2 - Offline Robustness**:

- [ ] Test: Authenticated user → offline → create work → online → verify sync
- [ ] Ensure session doesn't expire during short offline periods
- [ ] Add offline indicator UI

**Priority 3 - Multi-Platform**:

- [ ] Desktop: Test Tauri session persistence across restarts
- [ ] Mobile: Test Capacitor SecureStorage + offline writes
- [ ] All: Verify CAS scan runs after guest → user transition

## Testing Scenarios

**Guest → New Account (UPGRADE)**:

1. Work as guest, create data
2. Sign in with NEW account
3. Verify: Local data flushed to server, visible on other devices

**Guest → Existing Account (WIPE)**:

1. Work as guest, create data
2. Sign in with EXISTING account (has server data)
3. Verify: Guest data discarded, server data loaded

**Offline → Online (NO GUEST)**:

1. Sign in while online
2. Go offline, create data
3. Go online
4. Verify: Offline writes synced, user never became guest

## Key Files

| File                                              | Purpose                            |
| ------------------------------------------------- | ---------------------------------- |
| `apps/*/providers.tsx`                            | Auth state, upgrade decision logic |
| `packages/data/src/auth/upgradeGuest.ts`          | Upgrade implementation             |
| `packages/data/src/writeBuffer.ts`                | Offline write queue                |
| `apps/*/src/auth/session.ts`                      | Platform session management        |
| `packages/data/src/utils/coordinateLocalBlobs.ts` | Guest blob metadata                |

## Critical Rules

1. **Never mix guest + user data** → One or the other
2. **Upgrade only for NEW accounts** → Existing accounts = wipe guest data
3. **Offline ≠ Guest** → Authenticated users stay authenticated
4. **Session persistence** → Cookies/SecureStorage survive offline periods
5. **WriteBuffer = Offline Queue** → Flushes when online, no data loss
