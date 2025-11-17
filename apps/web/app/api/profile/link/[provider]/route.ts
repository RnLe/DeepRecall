/**
 * Account Linking API
 * POST /api/profile/link/[provider]
 *
 * Link additional OAuth provider to existing account.
 * If the provider identity already belongs to another account, trigger merge flow.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/lib/auth-helpers";
import { getPostgresPool } from "@/app/api/lib/postgres";

interface LinkRequest {
  id_token?: string; // For Google
  access_token?: string; // For GitHub
}

/**
 * Link Google account
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const userContext = await requireAuth(req);
    const { provider } = await params;

    if (provider !== "google" && provider !== "github") {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const body: LinkRequest = await req.json();
    const pool = getPostgresPool();

    // Verify and extract identity based on provider
    let providerUserId: string;
    let email: string | null = null;
    let displayName: string | null = null;
    let avatarUrl: string | null = null;

    if (provider === "google") {
      if (!body.id_token) {
        return NextResponse.json(
          { error: "Missing id_token" },
          { status: 400 }
        );
      }

      // Parse Google ID token (simplified - use google-auth-library in prod)
      const payload = parseGoogleIdToken(body.id_token);
      providerUserId = payload.sub;
      email = payload.email;
      displayName = payload.name;
      avatarUrl = payload.picture;
    } else if (provider === "github") {
      if (!body.access_token) {
        return NextResponse.json(
          { error: "Missing access_token" },
          { status: 400 }
        );
      }

      // Verify GitHub token
      const githubUser = await verifyGitHubToken(body.access_token);
      providerUserId = String(githubUser.id);
      email = githubUser.email;
      displayName = githubUser.name || githubUser.login;
      avatarUrl = githubUser.avatar_url;
    } else {
      return NextResponse.json(
        { error: "Unsupported provider" },
        { status: 400 }
      );
    }

    // Check if this identity already exists
    const existingIdentity = await pool.query(
      `
      SELECT user_id
      FROM linked_identities
      WHERE provider = $1 AND provider_user_id = $2
      `,
      [provider, providerUserId]
    );

    if (existingIdentity.rows.length > 0) {
      const existingUserId = existingIdentity.rows[0].user_id;

      if (existingUserId === userContext.userId) {
        // Already linked to this account
        return NextResponse.json({
          status: "already_linked",
          message: "This account is already linked",
        });
      } else {
        // Linked to a DIFFERENT account → trigger merge flow
        return NextResponse.json(
          {
            status: "conflict",
            message: "This account is linked to another user",
            conflictUserId: existingUserId,
          },
          { status: 409 }
        );
      }
    }

    // Link identity to current user
    await pool.query(
      `
      INSERT INTO linked_identities 
        (user_id, provider, provider_user_id, email, display_name, avatar_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        userContext.userId,
        provider,
        providerUserId,
        email,
        displayName,
        avatarUrl,
      ]
    );

    return NextResponse.json({
      status: "linked",
      message: `${provider} account linked successfully`,
      identity: {
        provider,
        email,
        displayName,
      },
    });
  } catch (error) {
    console.error("Account linking error:", error);
    return NextResponse.json(
      { error: "Failed to link account" },
      { status: 500 }
    );
  }
}

/**
 * Unlink OAuth provider from account
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const userContext = await requireAuth(req);
    const { provider } = params;

    const pool = getPostgresPool();

    // Check how many identities user has
    const identitiesCount = await pool.query(
      `SELECT COUNT(*) FROM linked_identities WHERE user_id = $1`,
      [userContext.userId]
    );

    if (parseInt(identitiesCount.rows[0].count) <= 1) {
      return NextResponse.json(
        { error: "Cannot unlink last identity" },
        { status: 400 }
      );
    }

    // Unlink identity
    const result = await pool.query(
      `
      DELETE FROM linked_identities
      WHERE user_id = $1 AND provider = $2
      RETURNING id
      `,
      [userContext.userId, provider]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Identity not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "unlinked",
      message: `${provider} account unlinked`,
    });
  } catch (error) {
    console.error("Account unlinking error:", error);
    return NextResponse.json(
      { error: "Failed to unlink account" },
      { status: 500 }
    );
  }
}

/**
 * Parse Google ID token (simplified)
 */
function parseGoogleIdToken(idToken: string) {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid ID token format");
  }

  const payload = JSON.parse(
    Buffer.from(parts[1], "base64url").toString("utf8")
  );

  if (!payload.sub || !payload.iss || !payload.aud) {
    throw new Error("Invalid ID token payload");
  }

  return payload;
}

/**
 * Verify GitHub access token
 */
async function verifyGitHubToken(accessToken: string) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error("Invalid GitHub token");
  }

  return response.json();
}
