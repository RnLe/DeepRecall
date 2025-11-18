import type { ReactNode } from "react";

/**
 * Lightweight shim used by the mobile bundle so that shared packages can
 * reference next-auth hooks without pulling in the full Next.js client.
 * These exports should never run in mobile; they exist solely to satisfy
 * the module graph. Each function throws to make the unsupported usage obvious.
 */

export function useSession() {
  throw new Error("next-auth/react is not available in the mobile runtime");
}

export function SessionProvider({ children }: { children: ReactNode }) {
  throw new Error(
    "SessionProvider from next-auth/react is unavailable on mobile"
  );
}

export async function signIn() {
  throw new Error("signIn from next-auth/react is unavailable on mobile");
}

export async function signOut() {
  throw new Error("signOut from next-auth/react is unavailable on mobile");
}
