/**
 * NextAuth Type Extensions
 *
 * Extend default NextAuth types to include custom fields.
 */

import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      provider: string; // "google" | "github"
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    provider?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    provider?: string;
  }
}
