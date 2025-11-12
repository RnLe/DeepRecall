/**
 * Account Merge API
 * POST /api/profile/merge
 *
 * Merge two user accounts when linking an identity that belongs to another account.
 *
 * Strategy options:
 * - "keep_current": Keep current account's data, discard other
 * - "keep_other": Keep other account's data, discard current
 * - "merge_all": Keep all data from both accounts
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/lib/auth-helpers";
import { getPostgresPool } from "@/app/api/lib/postgres";

interface MergeRequest {
  otherUserId: string; // UUID of account to merge
  strategy: "keep_current" | "keep_other" | "merge_all";
  primaryProfile?: "current" | "other"; // Which profile metadata to keep (for merge_all)
}

const USER_TABLES = [
  "works",
  "assets",
  "authors",
  "annotations",
  "cards",
  "review_logs",
  "collections",
  "edges",
  "presets",
  "activities",
  "boards",
  "strokes",
  "blobs_meta",
  "device_blobs",
  "replication_jobs",
];

export async function POST(req: NextRequest) {
  try {
    const userContext = await requireAuth(req);
    const body: MergeRequest = await req.json();

    const { otherUserId, strategy, primaryProfile = "current" } = body;

    if (!otherUserId || !strategy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["keep_current", "keep_other", "merge_all"].includes(strategy)) {
      return NextResponse.json({ error: "Invalid strategy" }, { status: 400 });
    }

    if (otherUserId === userContext.userId) {
      return NextResponse.json(
        { error: "Cannot merge account with itself" },
        { status: 400 }
      );
    }

    const pool = getPostgresPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Verify other account exists
      const otherUser = await client.query(
        `SELECT user_id, email, display_name, avatar_url FROM app_users WHERE user_id = $1`,
        [otherUserId]
      );

      if (otherUser.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Other account not found" },
          { status: 404 }
        );
      }

      // Determine which account to keep and which to delete
      const keepUserId =
        strategy === "keep_other" ? otherUserId : userContext.userId;
      const deleteUserId =
        strategy === "keep_other" ? userContext.userId : otherUserId;

      // Handle merge_all strategy
      if (strategy === "merge_all") {
        // Re-own all data from other account to current account
        for (const table of USER_TABLES) {
          await client.query(
            `UPDATE ${table} SET owner_id = $1 WHERE owner_id = $2`,
            [userContext.userId, otherUserId]
          );
        }

        // Transfer linked identities
        await client.query(
          `UPDATE linked_identities SET user_id = $1 WHERE user_id = $2`,
          [userContext.userId, otherUserId]
        );

        // Merge settings (other's settings override current's on conflicts)
        await client.query(
          `
          INSERT INTO user_settings (user_id, settings, updated_at)
          SELECT $1, settings, NOW()
          FROM user_settings
          WHERE user_id = $2
          ON CONFLICT (user_id) DO UPDATE
          SET 
            settings = user_settings.settings || EXCLUDED.settings,
            updated_at = NOW()
          `,
          [userContext.userId, otherUserId]
        );

        // Update profile metadata based on primaryProfile
        if (primaryProfile === "other") {
          await client.query(
            `
            UPDATE app_users
            SET 
              email = COALESCE($2, email),
              display_name = COALESCE($3, display_name),
              avatar_url = COALESCE($4, avatar_url),
              updated_at = NOW()
            WHERE user_id = $1
            `,
            [
              userContext.userId,
              otherUser.rows[0].email,
              otherUser.rows[0].display_name,
              otherUser.rows[0].avatar_url,
            ]
          );
        }

        // Delete other account
        await client.query(`DELETE FROM app_users WHERE user_id = $1`, [
          otherUserId,
        ]);
      } else if (strategy === "keep_other") {
        // Delete current account's data
        for (const table of USER_TABLES) {
          await client.query(`DELETE FROM ${table} WHERE owner_id = $1`, [
            userContext.userId,
          ]);
        }

        // Transfer current's identities to other account
        await client.query(
          `UPDATE linked_identities SET user_id = $1 WHERE user_id = $2`,
          [otherUserId, userContext.userId]
        );

        // Delete current account
        await client.query(`DELETE FROM app_users WHERE user_id = $1`, [
          userContext.userId,
        ]);
      } else {
        // keep_current: Delete other account's data
        for (const table of USER_TABLES) {
          await client.query(`DELETE FROM ${table} WHERE owner_id = $1`, [
            otherUserId,
          ]);
        }

        // Transfer other's identities to current account
        await client.query(
          `UPDATE linked_identities SET user_id = $1 WHERE user_id = $2`,
          [userContext.userId, otherUserId]
        );

        // Delete other account
        await client.query(`DELETE FROM app_users WHERE user_id = $1`, [
          otherUserId,
        ]);
      }

      await client.query("COMMIT");

      // Fetch updated profile
      const updatedProfile = await client.query(
        `
        SELECT user_id, email, display_name, avatar_url
        FROM app_users
        WHERE user_id = $1
        `,
        [keepUserId]
      );

      const linkedIdentities = await client.query(
        `
        SELECT id, provider, provider_user_id, email, display_name
        FROM linked_identities
        WHERE user_id = $1
        ORDER BY created_at ASC
        `,
        [keepUserId]
      );

      return NextResponse.json({
        status: "merged",
        message: "Accounts merged successfully",
        user: {
          id: updatedProfile.rows[0].user_id,
          email: updatedProfile.rows[0].email,
          displayName: updatedProfile.rows[0].display_name,
          avatarUrl: updatedProfile.rows[0].avatar_url,
        },
        linkedIdentities: linkedIdentities.rows.map((row) => ({
          id: row.id,
          provider: row.provider,
          email: row.email,
          displayName: row.display_name,
        })),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Account merge error:", error);
    return NextResponse.json(
      { error: "Failed to merge accounts" },
      { status: 500 }
    );
  }
}

/**
 * Get merge preview (what data exists in other account)
 * GET /api/profile/merge?otherUserId=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const userContext = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const otherUserId = searchParams.get("otherUserId");

    if (!otherUserId) {
      return NextResponse.json(
        { error: "Missing otherUserId" },
        { status: 400 }
      );
    }

    const pool = getPostgresPool();

    // Get counts of data in both accounts
    const counts: Record<string, { current: number; other: number }> = {};

    for (const table of USER_TABLES) {
      const result = await pool.query(
        `
        SELECT 
          SUM(CASE WHEN owner_id = $1 THEN 1 ELSE 0 END) as current_count,
          SUM(CASE WHEN owner_id = $2 THEN 1 ELSE 0 END) as other_count
        FROM ${table}
        WHERE owner_id IN ($1, $2)
        `,
        [userContext.userId, otherUserId]
      );

      counts[table] = {
        current: parseInt(result.rows[0]?.current_count || "0"),
        other: parseInt(result.rows[0]?.other_count || "0"),
      };
    }

    // Get profile info for both accounts
    const profiles = await pool.query(
      `
      SELECT user_id, email, display_name, avatar_url
      FROM app_users
      WHERE user_id IN ($1, $2)
      `,
      [userContext.userId, otherUserId]
    );

    const currentProfile = profiles.rows.find(
      (r) => r.user_id === userContext.userId
    );
    const otherProfile = profiles.rows.find((r) => r.user_id === otherUserId);

    return NextResponse.json({
      currentAccount: {
        id: currentProfile?.user_id,
        email: currentProfile?.email,
        displayName: currentProfile?.display_name,
      },
      otherAccount: {
        id: otherProfile?.user_id,
        email: otherProfile?.email,
        displayName: otherProfile?.display_name,
      },
      dataCounts: counts,
    });
  } catch (error) {
    console.error("Merge preview error:", error);
    return NextResponse.json(
      { error: "Failed to fetch merge preview" },
      { status: 500 }
    );
  }
}
