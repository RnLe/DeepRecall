/**
 * NextAuth Middleware
 *
 * Route protection for authenticated endpoints.
 *
 * CURRENT STATE (Phase 2): Authentication is OPTIONAL
 * - All routes are accessible without sign-in (guest mode)
 * - Middleware logs session info but does not block
 *
 * FUTURE (Phase 3+): Uncomment protection logic
 * - Require auth for write endpoints (/api/writes/*)
 * - Require auth for Electric replication (/electric-proxy/*)
 * - Keep guest mode for read-only operations
 *
 * See: AUTH_MIGRATION_GUIDE.md Phase 2
 */

import { auth } from "@/src/auth/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const session = await auth();

  // Log session info (for debugging during Phase 2)
  if (process.env.NODE_ENV === "development") {
    console.log("[Middleware]", {
      path: req.nextUrl.pathname,
      hasSession: !!session,
      userId: session?.user?.id,
      provider: session?.user?.provider,
    });
  }

  // ============================================================================
  // PHASE 2: AUTHENTICATION OPTIONAL (Guest Mode Enabled)
  // ============================================================================

  // For now, allow all requests through
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
// Note: /api/auth/* is excluded (handled by NextAuth)
export const config = {
  matcher: [
    "/api/:path*", // All API routes (except /api/auth/*)
    "/electric-proxy/:path*", // Electric sync endpoint (future)
  ],
};
