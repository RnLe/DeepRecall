/**
 * NextAuth Middleware
 *
 * Route protection for authenticated endpoints.
 *
 * CURRENT STATE (Phase 2): Authentication is OPTIONAL
 * - All routes are accessible without sign-in (guest mode)
 * - Middleware is DISABLED to avoid Edge runtime crypto errors
 *
 * FUTURE (Phase 3+): Re-enable with proper auth checks
 * - Require auth for write endpoints (/api/writes/*)
 * - Require auth for Electric replication (/electric-proxy/*)
 * - Keep guest mode for read-only operations
 *
 * See: AUTH_MIGRATION_GUIDE.md Phase 2
 *
 * IMPORTANT: Next.js middleware runs in Edge runtime which doesn't support
 * Node.js 'crypto' module. We'll enable auth checks in Phase 3 using a
 * different approach (per-route auth helpers instead of global middleware).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  // ============================================================================
  // PHASE 2: MIDDLEWARE DISABLED (Guest Mode)
  // ============================================================================

  // Allow all requests through
  // Auth checks will be added per-route in Phase 3 using requireAuth() helper
  return NextResponse.next();

  // ============================================================================
  // PHASE 3+: UNCOMMENT TO ENABLE ROUTE PROTECTION
  // ============================================================================

  /*
  const { pathname } = req.nextUrl;

  // Protect write endpoints (require authentication)
  if (pathname.startsWith("/api/writes/")) {
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
  }

  // Protect Electric replication endpoint (require authentication)
  if (pathname.startsWith("/electric-proxy/")) {
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
  }

  // Allow authenticated requests through
  return NextResponse.next();
  */
}

// Apply middleware to specific routes
// PHASE 2: Matcher disabled - no routes protected yet
export const config = {
  matcher: [
    // Commented out for Phase 2 - will re-enable in Phase 3
    // "/api/writes/:path*",
    // "/electric-proxy/:path*",
  ],
};
