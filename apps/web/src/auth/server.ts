/**
 * Server-Only Auth Entry Point
 *
 * Core NextAuth configuration that runs ONLY on the server.
 * Never import this file from client components or browser code.
 */

import "server-only";
import NextAuth from "next-auth";
import "./types"; // Import type extensions
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { getPostgresPool } from "@/app/api/lib/postgres";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,

  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          prompt: "select_account", // Force account selection
        },
      },
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],

  callbacks: {
    // JWT callback: runs when JWT is created/updated
    async jwt({ token, account, profile }) {
      // On first sign-in, find or create user via linked_identities
      if (account && profile) {
        const provider = account.provider;
        const providerUserId = profile.sub || account.providerAccountId;
        const email = (profile as any).email;
        const name =
          (profile as any).name ||
          (profile as any).login ||
          (profile as any).preferred_name;
        const avatarUrl =
          (profile as any).picture || (profile as any).avatar_url;

        // Find or create user account
        const user = await findOrCreateUser({
          provider,
          providerUserId,
          email,
          displayName: name,
          avatarUrl,
        });

        // Store canonical user_id in token
        token.userId = user.user_id;
        token.provider = provider;
        token.sub = providerUserId;
      }
      return token;
    },

    // Session callback: exposes token data to client
    async session({ session, token }) {
      if (session.user) {
        // Expose canonical user_id (UUID) to client
        session.user.id = token.userId as string;
        session.user.provider = token.provider as string;
      }
      return session;
    },

    // Optional: signIn callback for additional checks
    async signIn({ account, profile }) {
      // Add email verification checks here if needed
      // For now, allow all sign-ins from Google/GitHub
      return true;
    },
  },

  pages: {
    signIn: "/auth/signin", // Custom sign-in page
    error: "/auth/error", // Error page
  },

  session: {
    strategy: "jwt", // No database sessions (for now)
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Enable debug logs in development
  debug: process.env.NODE_ENV === "development",
});

/**
 * Find existing user by linked identity, or create new account
 *
 * NOTE: Requires Migration 008 (app_users, linked_identities tables)
 * Falls back to legacy behavior if tables don't exist
 */
async function findOrCreateUser(params: {
  provider: string;
  providerUserId: string;
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}) {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if Migration 008 tables exist
    const tablesExist = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'linked_identities'
      ) as has_linked_identities,
      EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'app_users'
      ) as has_app_users
    `);

    const { has_linked_identities, has_app_users } = tablesExist.rows[0];

    if (!has_linked_identities || !has_app_users) {
      // Migration 008 not run - return legacy format
      await client.query("ROLLBACK");
      console.warn("[Auth] Migration 008 not run - using legacy user format");
      return {
        user_id: `${params.provider}:${params.providerUserId}`,
        email: params.email,
        display_name: params.displayName,
        avatar_url: params.avatarUrl,
      };
    }

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

      // Update identity metadata
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
