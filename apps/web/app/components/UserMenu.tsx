"use client";

/**
 * Web Platform User Menu Wrapper
 *
 * Thin wrapper around platform-agnostic UserMenu component.
 * Connects NextAuth session to the shared UI component.
 */

import { useSession, signOut } from "@/src/auth/client";
import { useRouter } from "next/navigation";
import { UserMenu as SharedUserMenu } from "@deeprecall/ui";

export function UserMenu() {
  const { data: session, status } = useSession();
  const router = useRouter();

  return (
    <SharedUserMenu
      session={session}
      status={status}
      onSignIn={() => router.push("/auth/signin")}
      onSignOut={() => signOut({ callbackUrl: "/library" })}
      onNavigateProfile={() => router.push("/profile")}
    />
  );
}
