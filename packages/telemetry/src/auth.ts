/**
 * Authentication Integration for Telemetry
 *
 * FUTURE: When OAuth/NextAuth is implemented, this module will provide
 * privacy-safe user tracking for telemetry.
 *
 * See: GUIDE_LOGGING.md - Section 7 (User/Session/Device Tracking)
 */

/**
 * Derive pseudonymous actor_uid from OAuth identity
 *
 * @param provider - OAuth provider (google, github, etc.)
 * @param subject - OAuth subject (sub from token)
 * @returns base64url(HMAC_SHA256(secret, provider:subject))
 *
 * FUTURE: Implement when auth is added
 */
export function deriveActorUid(provider: string, subject: string): string {
  // TODO: Implement HMAC derivation
  // const secret = process.env.AUTH_HMAC_SECRET;
  // const input = `${provider}:${subject}`;
  // return base64url(HMAC_SHA256(secret, input));

  throw new Error(
    "Authentication not yet implemented. See GUIDE_LOGGING.md Phase 5"
  );
}

/**
 * Generate new session ID (UUID v4)
 *
 * FUTURE: Called on each login
 */
export function generateSessionId(): string {
  // TODO: Implement when auth is added
  // return crypto.randomUUID();

  throw new Error(
    "Authentication not yet implemented. See GUIDE_LOGGING.md Phase 5"
  );
}

/**
 * User context for telemetry (attached to logs)
 *
 * FUTURE: Populated from auth state
 */
export interface TelemetryUserContext {
  actorUid: string; // Pseudonymous (HMAC-based)
  sessionId: string; // UUID per login
  deviceId: string; // Already exists in app
  provider?: string; // OAuth provider (low-cardinality)
}

/**
 * Get current user context for telemetry
 *
 * FUTURE: Returns null when not authenticated
 */
export function getTelemetryUserContext(): TelemetryUserContext | null {
  // TODO: Implement when auth is added
  // const auth = useAuth(); // or getAuthState()
  // if (!auth.isAuthenticated) return null;
  // return {
  //   actorUid: auth.actorUid,
  //   sessionId: auth.sessionId,
  //   deviceId: getDeviceId(),
  //   provider: auth.provider,
  // };

  return null; // Not authenticated (auth not implemented yet)
}

/**
 * Correlation headers for API requests
 *
 * FUTURE: Add to fetch wrapper when auth is implemented
 */
export function getTelemetryHeaders(): Record<string, string> {
  const context = getTelemetryUserContext();
  if (!context) return {};

  return {
    "X-DR-Actor": context.actorUid,
    "X-DR-Session": context.sessionId,
    "X-DR-Device": context.deviceId,
  };
}
