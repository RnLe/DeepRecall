/**
 * Admin authentication for Dojo admin routes
 * Simple password-based auth for development (not production-ready)
 *
 * Password is hardcoded for dev: deeprecall4815
 */

import { NextRequest, NextResponse } from "next/server";
import { addCorsHeaders } from "./cors";

const ADMIN_PASSWORD = "deeprecall4815";
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

export interface AdminContext {
  isAdmin: true;
  systemUserId: string;
}

/**
 * Verify admin password from request
 * Expects either:
 * - X-Admin-Password header
 * - admin_password query param (for testing)
 * - adminPassword in request body
 */
export function verifyAdminPassword(req: NextRequest, body?: unknown): boolean {
  // Check header first
  const headerPassword = req.headers.get("x-admin-password");
  if (headerPassword === ADMIN_PASSWORD) {
    return true;
  }

  // Check query param
  const { searchParams } = new URL(req.url);
  const queryPassword = searchParams.get("admin_password");
  if (queryPassword === ADMIN_PASSWORD) {
    return true;
  }

  // Check body if provided
  if (body && typeof body === "object" && "adminPassword" in body) {
    const bodyPassword = (body as { adminPassword?: string }).adminPassword;
    if (bodyPassword === ADMIN_PASSWORD) {
      return true;
    }
  }

  return false;
}

/**
 * Require admin authentication
 * Returns AdminContext if valid, throws otherwise
 */
export function requireAdmin(req: NextRequest, body?: unknown): AdminContext {
  if (!verifyAdminPassword(req, body)) {
    throw new Error("Admin authentication required");
  }

  return {
    isAdmin: true,
    systemUserId: SYSTEM_USER_ID,
  };
}

/**
 * Create an unauthorized response for admin routes
 */
export function adminUnauthorizedResponse(
  req: NextRequest
): NextResponse | Response {
  return addCorsHeaders(
    NextResponse.json(
      {
        error: "Admin authentication required",
        hint: "Provide admin password via X-Admin-Password header",
      },
      { status: 401 }
    ),
    req
  );
}

/**
 * Get the system user ID used for global content
 */
export function getSystemUserId(): string {
  return SYSTEM_USER_ID;
}
