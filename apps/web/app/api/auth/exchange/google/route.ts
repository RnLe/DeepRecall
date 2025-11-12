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

  // Verify audience matches one of our client IDs (desktop or mobile)
  const validClientIds = [
    process.env.GOOGLE_DESKTOP_CLIENT_ID,
    process.env.GOOGLE_MOBILE_CLIENT_ID,
  ].filter(Boolean);

  if (!validClientIds.includes(payload.aud)) {
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

    // Find or create user account via linked identity
    const user = await findOrCreateUser({
      provider,
      providerUserId: userId,
      email,
      displayName: name,
      avatarUrl: payload.picture,
    });

    // Generate app JWT (6h expiry) with canonical user_id
    const app_jwt = await signAppJWT(
      {
        userId: user.user_id,
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
          id: user.user_id,
          provider,
          email: user.email,
          name: user.display_name,
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
 * Find existing user by linked identity, or create new account
 *
 * Logic:
 * 1. Check if this provider identity already exists
 * 2. If yes → return that user account
 * 3. If no → create new user account + link this identity
 */
async function findOrCreateUser(params: {
  provider: string;
  providerUserId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}) {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if this identity is already linked to an account
    const existingIdentity = await client.query(
      `
      SELECT user_id 
      FROM linked_identities 
      WHERE provider = $1 AND provider_user_id = $2
      `,
      [params.provider, params.providerUserId]
    );

    let userId: string;

    if (existingIdentity.rows.length > 0) {
      // Identity exists → use that account
      userId = existingIdentity.rows[0].user_id;

      // Update identity metadata (email, name, avatar may have changed)
      await client.query(
        `
        UPDATE linked_identities
        SET 
          email = COALESCE($3, email),
          display_name = COALESCE($4, display_name),
          avatar_url = COALESCE($5, avatar_url)
        WHERE provider = $1 AND provider_user_id = $2
        `,
        [
          params.provider,
          params.providerUserId,
          params.email,
          params.displayName,
          params.avatarUrl,
        ]
      );
    } else {
      // New identity → create new user account
      const newUser = await client.query(
        `
        INSERT INTO app_users (email, display_name, avatar_url)
        VALUES ($1, $2, $3)
        RETURNING user_id
        `,
        [params.email, params.displayName, params.avatarUrl]
      );

      userId = newUser.rows[0].user_id;

      // Link this identity to the new account
      await client.query(
        `
        INSERT INTO linked_identities 
          (user_id, provider, provider_user_id, email, display_name, avatar_url)
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          userId,
          params.provider,
          params.providerUserId,
          params.email,
          params.displayName,
          params.avatarUrl,
        ]
      );
    }

    await client.query("COMMIT");

    // Fetch complete user info
    const user = await client.query(
      `SELECT user_id, email, display_name, avatar_url FROM app_users WHERE user_id = $1`,
      [userId]
    );

    return user.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
