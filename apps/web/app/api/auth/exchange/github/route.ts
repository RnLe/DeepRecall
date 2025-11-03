/**
 * GitHub OAuth Token Exchange
 *
 * Desktop/mobile apps complete device code flow with GitHub,
 * then exchange the access_token here for an app JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { signAppJWT, deriveActorUid } from "@/src/auth/jwt";
import { getPostgresPool } from "@/app/api/lib/postgres";
import {
  handleCorsOptions,
  checkCorsOrigin,
  corsHeaders,
} from "@/app/api/lib/cors";

interface ExchangeRequest {
  access_token: string;
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
    const { access_token, device_id }: ExchangeRequest = await req.json();

    if (!access_token || !device_id) {
      return NextResponse.json(
        { error: "Missing access_token or device_id" },
        { status: 400, headers: corsHeaders(req.headers.get("origin") ?? "") }
      );
    }

    // Verify GitHub access token by fetching user
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: "Invalid GitHub access token" },
        {
          status: 401,
          headers: corsHeaders(req.headers.get("origin") ?? ""),
        }
      );
    }

    const githubUser = await userResponse.json();
    const userId = String(githubUser.id); // GitHub numeric ID (stable)
    const provider = "github";
    const email = githubUser.email;
    const name = githubUser.name || githubUser.login;

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
    console.error("GitHub token exchange error:", error);
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
  email?: string | null;
  name?: string | null;
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
