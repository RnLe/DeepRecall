/**
 * Authentication helpers for API routes
 * Supports both NextAuth (web) and JWT (desktop/mobile)
 */

import { auth } from "@/src/auth/server";
import { NextRequest } from "next/server";
import { verifyAppJWT } from "@/src/auth/jwt";
import { headers } from "next/headers";

export interface UserContext {
  userId: string;
  provider: string;
  deviceId?: string;
}

/**
 * Get user context from request
 * Handles both NextAuth (web) and JWT Bearer token (desktop/mobile)
 */
export async function getUserContext(
  req: NextRequest
): Promise<UserContext | null> {
  // Try Authorization header first (desktop/mobile platforms)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);

    try {
      const payload = await verifyAppJWT(token);

      return {
        userId: payload.userId,
        provider: payload.provider,
        deviceId: payload.deviceId,
      };
    } catch (error) {
      console.error("[Auth] Invalid JWT:", error);
      // Fall through to try session
    }
  }

  // Try NextAuth session (web platform)
  // In API routes, auth() reads from request context automatically
  try {
    const session = await auth();

    console.log("[Auth] Session check in API route:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      hasCookies: req.cookies.getAll().length,
    });

    if (session?.user?.id) {
      return {
        userId: session.user.id,
        provider: session.user.provider,
      };
    }
  } catch (error) {
    console.error("[Auth] Failed to get session:", error);
  }

  console.log("[Auth] No authentication found");
  return null;
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(req: NextRequest): Promise<UserContext> {
  const user = await getUserContext(req);
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}
