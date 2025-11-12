/**
 * Profile Settings API
 * GET/PATCH /api/profile/settings
 *
 * Settings stored as JSONB for flexibility
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/lib/auth-helpers";
import { getPostgresPool } from "@/app/api/lib/postgres";

/**
 * Get user settings
 */
export async function GET(req: NextRequest) {
  try {
    const userContext = await requireAuth(req);
    const pool = getPostgresPool();

    const result = await pool.query(
      `
      SELECT data as settings, updated_at
      FROM user_settings
      WHERE owner_id = $1
      `,
      [userContext.userId]
    );

    if (result.rows.length === 0) {
      // No settings yet - return empty object
      return NextResponse.json({
        settings: {},
        updatedAt: null,
      });
    }

    return NextResponse.json({
      settings: result.rows[0].settings,
      updatedAt: result.rows[0].updated_at,
    });
  } catch (error) {
    console.error("Settings fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * Update user settings (merge with existing)
 */
export async function PATCH(req: NextRequest) {
  try {
    const userContext = await requireAuth(req);
    const body = await req.json();

    // Validate that body is a valid object
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid settings object" },
        { status: 400 }
      );
    }

    const pool = getPostgresPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Set RLS context
      await client.query("SET LOCAL app.user_id = $1", [userContext.userId]);

      // Upsert settings (merge with existing JSONB)
      const result = await client.query(
        `
        INSERT INTO user_settings (owner_id, data, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (owner_id) DO UPDATE
        SET 
          data = user_settings.data || $2,
          updated_at = NOW()
        RETURNING data as settings, updated_at
        `,
        [userContext.userId, JSON.stringify(body)]
      );
      await client.query("COMMIT");

      return NextResponse.json({
        settings: result.rows[0].settings,
        updatedAt: result.rows[0].updated_at,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

/**
 * Replace all settings (no merge)
 */
export async function PUT(req: NextRequest) {
  try {
    const userContext = await requireAuth(req);
    const body = await req.json();

    if (!body.settings || typeof body.settings !== "object") {
      return NextResponse.json(
        { error: "Invalid settings object" },
        { status: 400 }
      );
    }

    const pool = getPostgresPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Set RLS context
      await client.query("SET LOCAL app.user_id = $1", [userContext.userId]);

      // Replace settings entirely
      const result = await client.query(
        `
        INSERT INTO user_settings (owner_id, data, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (owner_id) DO UPDATE
        SET 
          data = EXCLUDED.data,
          updated_at = NOW()
        RETURNING data as settings, updated_at
        `,
        [userContext.userId, JSON.stringify(body.settings)]
      );

      await client.query("COMMIT");

      return NextResponse.json({
        settings: result.rows[0].settings,
        updatedAt: result.rows[0].updated_at,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Settings replace error:", error);
    return NextResponse.json(
      { error: "Failed to replace settings" },
      { status: 500 }
    );
  }
}
