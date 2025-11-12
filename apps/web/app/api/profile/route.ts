/**
 * Profile API - Get user profile with linked identities
 * GET /api/profile
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/lib/auth-helpers";
import { getPostgresPool } from "@/app/api/lib/postgres";

export async function GET(req: NextRequest) {
  try {
    const userContext = await requireAuth(req);
    const pool = getPostgresPool();

    // Fetch user profile
    const userResult = await pool.query(
      `
      SELECT user_id, email, display_name, avatar_url, created_at, updated_at
      FROM app_users
      WHERE user_id = $1
      `,
      [userContext.userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];

    // Fetch linked identities
    const identitiesResult = await pool.query(
      `
      SELECT id, provider, provider_user_id, email, display_name, avatar_url, linked_at as created_at
      FROM linked_identities
      WHERE user_id = $1
      ORDER BY linked_at ASC
      `,
      [userContext.userId]
    );

    return NextResponse.json({
      user: {
        id: user.user_id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
      linkedIdentities: identitiesResult.rows.map((row) => ({
        id: row.id,
        provider: row.provider,
        providerUserId: row.provider_user_id,
        email: row.email,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

/**
 * Update user profile (display name, avatar)
 * PATCH /api/profile
 */
export async function PATCH(req: NextRequest) {
  try {
    const userContext = await requireAuth(req);
    const body = await req.json();

    const { displayName, avatarUrl } = body;

    if (!displayName && !avatarUrl) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const pool = getPostgresPool();

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (displayName !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(displayName);
    }

    if (avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramCount++}`);
      values.push(avatarUrl);
    }

    updates.push(`updated_at = NOW()`);
    values.push(userContext.userId);

    const result = await pool.query(
      `
      UPDATE app_users
      SET ${updates.join(", ")}
      WHERE user_id = $${paramCount}
      RETURNING user_id, email, display_name, avatar_url, updated_at
      `,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = result.rows[0];

    return NextResponse.json({
      user: {
        id: user.user_id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        updatedAt: user.updated_at,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
