/**
 * NextAuth API Route Handlers
 *
 * Handles OAuth callbacks, sign-in, sign-out flows.
 * Accessible at /api/auth/signin, /api/auth/callback/google, etc.
 */

import { handlers } from "@/src/auth/server";

export const { GET, POST } = handlers;
