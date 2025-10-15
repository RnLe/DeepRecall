import NextAuth, { User } from "next-auth"
import GitHub from "next-auth/providers/github"

// Extend the built-in NextAuth User to include the GitHub ID
declare module "next-auth" {
  interface User {
    providerAccountId?: string;
    provider?: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      if (isLoggedIn) return true;
      return false; // Redirect unauthenticated users to login page
    },
    async jwt({ token, account, profile }) {
      // Wenn es der erste Login in dieser Session ist, gibt es ein "account"
      if (account) {
        // account.providerAccountId => GitHub User ID
        token.githubId = account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      // Damit "session.user" das Feld "providerAccountId" enthält
      if (token.githubId) {
        session.user.providerAccountId = token.githubId as string;
        session.user.provider = "github";
      }
      return session;
    },
  }
}) satisfies { handlers: any, signIn: any, signOut: any, auth: any }

export function isPublicRoute(route: string): boolean {
  const disallowedRoutes = ["/leaderboards", "/profile", "/dojo"];
  return !disallowedRoutes.some(disallowedRoute => route.includes(disallowedRoute));
}

export function checkAuth({ auth, route }: { auth: any, route: string }) {
  const isLoggedIn = !!auth?.user;
  if (isLoggedIn) return true;
  return isPublicRoute(route);
}