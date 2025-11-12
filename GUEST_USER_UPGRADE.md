# Guest ↔ User Upgrade Flow

## Decision Matrix

```
┌─────────────────┬──────────────────┬─────────────────────────┐
│ Current State   │ Action           │ Outcome                 │
├─────────────────┼──────────────────┼─────────────────────────┤
│ Guest (no data) │ Sign in (new)    │ Start fresh, no upgrade │
│ Guest (no data) │ Sign in (exists) │ Start fresh, no upgrade │
│ Guest (has data)│ Sign in (new)    │ UPGRADE: Flush to server│
│ Guest (has data)│ Sign in (exists) │ WIPE: Clear local data  │
└─────────────────┴──────────────────┴─────────────────────────┘
```

**Rule**: Only upgrade guest data when signing into a **NEW** account.
If user already has server data, **discard** local guest data (prevent conflicts).

## Implementation Checklist

### 1. Detect Account Status (Sign-In)

**File**: `apps/*/providers.tsx` → `AuthStateManager`

```typescript
useEffect(() => {
  if (authenticated && !hasUpgradedRef.current) {
    // Check if account is NEW or EXISTING
    const isNewAccount = await checkAccountIsNew(userId);

    if (hasGuestData() && isNewAccount) {
      await upgradeGuestToUser(userId, deviceId, cas, apiBaseUrl);
    } else if (hasGuestData() && !isNewAccount) {
      await wipeGuestData(); // Existing account = discard guest data
    }
  }
}, [authenticated, userId]);
```

**Check**: Query server for user's data (works count, etc.)

- Zero rows = NEW account → upgrade
- Has rows = EXISTING account → wipe

### 2. Offline Auth Support

**Goal**: Authenticated users work offline without becoming guests.

**Session Persistence** (Already Working):

- NextAuth stores session in cookies/localStorage
- `useSession()` returns cached session when offline
- User stays authenticated across app restarts

**Offline Write Pattern**:

```
User offline → Write to *_local tables → Buffer in WriteBuffer
              ↓
User online  → Flush buffer → Postgres → Electric → Sync back
```

**Critical**: Never demote authenticated user to guest during offline periods.

### 3. Platform-Specific Concerns

**Web** (`apps/web`):

- ✅ Session in cookies (httpOnly, secure)
- ✅ WriteBuffer persists in IndexedDB
- ⚠️ Must handle page refresh without session re-fetch

**Desktop** (`apps/desktop`):

- ✅ Session in Tauri secure storage
- ✅ CAS in filesystem (persistent)
- ⚠️ Check Tauri auth plugin handles offline gracefully

**Mobile** (`apps/mobile`):

- ✅ Session in Capacitor SecureStorage
- ✅ CAS in iOS Documents directory
- ⚠️ Handle app backgrounding/foregrounding

### 4. Sync Architecture Guards

**Electric Shapes** (Multi-Tenant Isolation):

```typescript
// Already implemented - always filter by owner_id
useShape({
  where: userId ? `owner_id = '${userId}'` : undefined,
});
```

**Guest**: `userId = undefined` → No Electric sync
**User offline**: `userId = cached` → Shapes stay filtered, no new data until online

**WriteBuffer Flushing**:

```typescript
// Already implemented - guest writes skip buffer
if (isAuthenticated()) {
  await buffer.enqueue(change); // Will flush when online
} else {
  // Guest: local-only, no enqueue
}
```

**API Endpoint Guards** (CRITICAL):

```typescript
// Pattern: Skip server calls for guests
async syncBlobToElectric(sha256: string) {
  const { isAuthenticated } = await import("@deeprecall/data");

  if (!isAuthenticated()) {
    // Guest: Skip server sync, work purely locally
    return;
  }

  // Authenticated: Call server endpoint
  await fetch("/api/admin/sync-blob", { ... });
}
```

**Files to check**:

- ✅ `LinkBlobDialog.tsx` - blob sync skipped for guests
- Check any other server API calls in UI components

```typescript
// Already implemented - guest writes skip buffer
if (isAuthenticated()) {
  await buffer.enqueue(change); // Will flush when online
} else {
  // Guest: local-only, no enqueue
}
```

### 5. Edge Cases

| Scenario                                       | Handling                                          |
| ---------------------------------------------- | ------------------------------------------------- |
| Sign in fails mid-upgrade                      | Rollback: Keep guest state, retry later           |
| User cancels sign-in dialog                    | Keep guest mode, no changes                       |
| Network drops during flush                     | WriteBuffer retries with backoff                  |
| User signs in on Device A, then Device B       | Each device upgrades independently if NEW account |
| Sign out, then immediately sign in (same user) | Wipe guest data (existing account)                |

### 6. Required Changes

**Priority 1 - Account Detection**:

- [ ] Add `/api/user/is-new` endpoint (check works/assets count)
- [ ] Call from `AuthStateManager` before upgrade decision
- [ ] Add `wipeGuestData()` function (clear \*\_local tables only)

**Priority 2 - Offline Robustness**:

- [ ] Test: Authenticated user → go offline → create work → go online → verify sync
- [ ] Ensure session doesn't expire during short offline periods
- [ ] Add offline indicator UI

**Priority 3 - Multi-Platform**:

- [ ] Desktop: Test Tauri session persistence across app restarts
- [ ] Mobile: Test Capacitor SecureStorage + offline writes
- [ ] All: Verify CAS scan runs after guest → user transition

### 7. Testing Matrix

```bash
# Guest → New Account (UPGRADE)
1. Work as guest, create data
2. Sign in with NEW account
3. Verify: Local data flushed to server, visible on other devices

# Guest → Existing Account (WIPE)
1. Work as guest, create data
2. Sign in with EXISTING account (has server data)
3. Verify: Guest data discarded, server data loaded

# Offline → Online (NO GUEST)
1. Sign in while online
2. Go offline, create data
3. Go online
4. Verify: Offline writes synced, user never became guest
```

### 8. Key Files

| File                                              | Purpose                            |
| ------------------------------------------------- | ---------------------------------- |
| `apps/*/providers.tsx`                            | Auth state, upgrade decision logic |
| `packages/data/src/auth/upgradeGuest.ts`          | Upgrade implementation             |
| `packages/data/src/writeBuffer.ts`                | Offline write queue                |
| `apps/*/src/auth/session.ts`                      | Platform session management        |
| `packages/data/src/utils/coordinateLocalBlobs.ts` | Guest blob metadata                |

---

## Critical Rules

1. **Never mix guest + user data** → One or the other
2. **Upgrade only for NEW accounts** → Existing accounts = wipe guest data
3. **Offline ≠ Guest** → Authenticated users stay authenticated
4. **Session persistence** → Cookies/SecureStorage survive offline periods
5. **WriteBuffer = Offline Queue** → Flushes when online, no data loss
