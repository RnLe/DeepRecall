/**
 * NextAuth API Route Handlers
 *
 * Handles OAuth callbacks, sign-in, sign-out flows.
 * Accessible at /api/auth/signin, /api/auth/callback/google, etc.
 *
 * IMPORTANT: Force Node.js runtime (not Edge) because NextAuth uses crypto
 */

import { handlers } from "@/src/auth/server";

// Force Node.js runtime (NextAuth needs crypto module)
export const runtime = "nodejs";

export const { GET, POST } = handlers;
