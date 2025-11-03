/**
 * Google OAuth Token Exchange
 *
 * Desktop/mobile apps do PKCE flow with Google directly,
 * then exchange the id_token here for an app JWT.
 *
 * No client secret verification needed (PKCE protects the flow).
 */

import { NextRequest, NextResponse } from "next/server";
import { signAppJWT, deriveActorUid } from "@/src/auth/jwt";
import { getPostgresPool } from "@/app/api/lib/postgres";
import {
  handleCorsOptions,
  checkCorsOrigin,
  corsHeaders,
} from "@/app/api/lib/cors";

/**
 * Parse and validate Google ID token
 * For production, use google-auth-library for signature verification
 * For MVP, we trust the token came from Google OAuth flow
 */
function parseGoogleIdToken(idToken: string) {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid ID token format");
  }

  const payload = JSON.parse(
    Buffer.from(parts[1], "base64url").toString("utf8")
  );

  // Basic validation
  if (!payload.sub || !payload.iss || !payload.aud) {
    throw new Error("Invalid ID token payload");
  }

  // Verify issuer
  if (!payload.iss.includes("accounts.google.com")) {
    throw new Error("Invalid issuer");
  }

  // Verify audience matches our client ID
  if (payload.aud !== process.env.GOOGLE_DESKTOP_CLIENT_ID) {
    throw new Error("Invalid audience");
  }

  // Check expiry
  if (payload.exp && payload.exp < Date.now() / 1000) {
    throw new Error("Token expired");
  }

  return payload;
}

interface ExchangeRequest {
  id_token: string;
  device_id: string;
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsOptions(req);
}

export async function POST(req: NextRequest) {
  // Check CORS origin
  const corsError = checkCorsOrigin(req);
  if (corsError) return corsError;

  try {
    const { id_token, device_id }: ExchangeRequest = await req.json();

    if (!id_token || !device_id) {
      return NextResponse.json(
        { error: "Missing id_token or device_id" },
        { status: 400, headers: corsHeaders(req.headers.get("origin") ?? "") }
      );
    }

    // Parse and validate Google ID token
    const payload = parseGoogleIdToken(id_token);

    const userId = payload.sub; // OIDC subject (stable per user)
    const provider = "google";
    const email = payload.email;
    const name = payload.name;

    // Upsert user in app_users table
    await upsertUser({ userId, provider, email, name });

    // Generate app JWT (6h expiry)
    const app_jwt = await signAppJWT(
      {
        userId,
        provider,
        deviceId: device_id,
      },
      { expiresIn: "6h" }
    );

    // Derive pseudonymous actor_uid for logging
    const actor_uid = deriveActorUid(provider, userId);

    return NextResponse.json(
      {
        app_jwt,
        actor_uid,
        user: {
          id: userId,
          provider,
          email,
          name,
        },
      },
      {
        headers: corsHeaders(req.headers.get("origin") ?? ""),
      }
    );
  } catch (error) {
    console.error("Google token exchange error:", error);
    return NextResponse.json(
      { error: "Token exchange failed" },
      {
        status: 500,
        headers: corsHeaders(req.headers.get("origin") ?? ""),
      }
    );
  }
}

/**
 * Upsert user in app_users table
 */
async function upsertUser(params: {
  userId: string;
  provider: string;
  email?: string;
  name?: string;
}) {
  const pool = getPostgresPool();

  await pool.query(
    `
    INSERT INTO app_users (id, provider, email, name, created_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (id) DO UPDATE
    SET 
      email = COALESCE(EXCLUDED.email, app_users.email),
      name = COALESCE(EXCLUDED.name, app_users.name),
      updated_at = NOW()
    `,
    [params.userId, params.provider, params.email, params.name]
  );
}
