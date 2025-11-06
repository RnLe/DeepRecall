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
      // On first sign-in, attach provider and sub from OIDC
      if (account && profile) {
        token.provider = account.provider; // "google" | "github"
        token.sub = profile.sub || account.providerAccountId; // OIDC subject
      }
      return token;
    },

    // Session callback: exposes token data to client
    async session({ session, token }) {
      if (session.user) {
        // Expose user ID (OIDC sub) and provider to client
        session.user.id = token.sub as string;
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
