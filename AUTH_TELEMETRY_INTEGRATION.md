# Authentication Integration Reference

> **Quick reference for integrating auth with telemetry (Phase 5)**

## When to Implement

This phase is **blocked** until:

- OAuth provider is configured (Google, GitHub, etc.)
- NextAuth or similar is set up
- User session management is implemented

## What to Do

### 1. Server-Side: Derive Actor UID

```typescript
// apps/web/src/auth/utils.ts
import crypto from "crypto";

export function deriveActorUid(provider: string, subject: string): string {
  const secret = process.env.AUTH_HMAC_SECRET!;
  const input = `${provider}:${subject}`;
  const hmac = crypto.createHmac("sha256", secret).update(input).digest();
  return hmac.toString("base64url");
}
```

**Environment variable**: `AUTH_HMAC_SECRET` (generate with `openssl rand -base64 32`)

### 2. OAuth Callback: Store IDs

```typescript
// apps/web/app/api/auth/[...nextauth]/route.ts (NextAuth example)
callbacks: {
  async jwt({ token, account }) {
    if (account) {
      // Derive pseudonymous ID
      const actorUid = deriveActorUid(account.provider, token.sub!);
      const sessionId = crypto.randomUUID();

      token.actorUid = actorUid;
      token.sessionId = sessionId;
      token.provider = account.provider;
    }
    return token;
  },
  async session({ session, token }) {
    session.actorUid = token.actorUid;
    session.sessionId = token.sessionId;
    session.provider = token.provider;
    return session;
  }
}
```

### 3. Client: Update Telemetry Context

```typescript
// apps/web/src/telemetry.ts (update initTelemetry)
export function updateTelemetryUserContext(
  actorUid: string,
  sessionId: string,
  provider: string
) {
  // Re-register OTLP sink with user context
  const deviceId = getDeviceId();

  registerSinks(
    ringBuffer,
    consoleSink, // dev only
    makeOtlpHttpSink(endpoint, {
      app: "deeprecall",
      platform: "web",
      env: process.env.NODE_ENV,
      actor_uid: actorUid,
      session_id: sessionId,
      device_id: deviceId,
      provider: provider,
    })
  );
}

// Call after sign-in
const session = await getSession();
if (session) {
  updateTelemetryUserContext(
    session.actorUid,
    session.sessionId,
    session.provider
  );
}
```

### 4. API: Add Correlation Headers

```typescript
// apps/web/src/utils/api.ts
export async function apiFetch(url: string, options: RequestInit = {}) {
  const session = await getSession();

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(session && {
        "X-DR-Actor": session.actorUid,
        "X-DR-Session": session.sessionId,
        "X-DR-Device": getDeviceId(),
      }),
    },
  });
}
```

### 5. Server: Log with User Context

```typescript
// apps/web/app/api/writes/batch/route.ts
export async function POST(req: Request) {
  const actorUid = req.headers.get("X-DR-Actor");
  const sessionId = req.headers.get("X-DR-Session");

  logger.info("server.api", "Batch write request", {
    actorUid,
    sessionId,
    operations: batch.length,
  });

  // ... handle request
}
```

## Querying in Grafana

```logql
# All logs for a user (pseudonymous)
{app="deeprecall", env="prod"}
| json
| actor_uid = "uD1...base64..."

# All logs for a session
{app="deeprecall", env="prod"}
| json
| session_id = "2a1c7f2e-..."

# Server + client correlation
{app="deeprecall"}
| json
| actor_uid = "..." and session_id = "..."
| line_format "{{.domain}} | {{.msg}}"
```

## Privacy Checklist

Before enabling user tracking:

- [ ] Generate strong HMAC secret (`AUTH_HMAC_SECRET`)
- [ ] Verify no PII in log events (audit existing logs)
- [ ] Configure Loki retention (7-14 days recommended)
- [ ] Update privacy policy (mention pseudonymous logging)
- [ ] Test HMAC derivation (same user = same actor_uid)
- [ ] Test secret rotation (new secret = new actor_uids)
- [ ] Document deletion process (short retention)

## Testing

```typescript
// Test HMAC stability
const uid1 = deriveActorUid("google", "123456");
const uid2 = deriveActorUid("google", "123456");
assert(uid1 === uid2); // Same input = same output

// Test HMAC uniqueness
const uid3 = deriveActorUid("google", "789012");
assert(uid1 !== uid3); // Different subject = different output

// Test provider separation
const uid4 = deriveActorUid("github", "123456");
assert(uid1 !== uid4); // Different provider = different output
```

## References

- `GUIDE_LOGGING.md` - Section 7 (full details)
- `LOGGING_MIGRATION_CHECKLIST.md` - Phase 5 checklist
- `LOGGING_IMPLEMENTATION_GUIDE.md` - Authentication section
- `packages/telemetry/src/auth.ts` - Stub implementations
