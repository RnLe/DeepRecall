/**
 * Entitlements Hook
 *
 * Provides feature flags and access control based on user authentication state.
 * For now, all authenticated users have full access (no tiers).
 * Future: Add subscription tier checks.
 */

import { useSession } from "next-auth/react";

export interface Entitlements {
  // Auth state
  isGuest: boolean;
  isAuthenticated: boolean;

  // Subscription tier (future)
  isPro: boolean;
  isEnterprise: boolean;

  // Feature flags
  canSync: boolean;
  canShare: boolean;
  canExport: boolean;
  canImport: boolean;
  canCollaborate: boolean;

  // Limits
  maxLibrarySize: number; // -1 = unlimited
}

/**
 * Get user entitlements based on authentication state
 *
 * @example
 * ```tsx
 * const entitlements = useEntitlements();
 *
 * if (entitlements.canImport) {
 *   return <ImportButton />;
 * } else {
 *   return <Button disabled>Import (Pro)</Button>;
 * }
 * ```
 */
export function useEntitlements(): Entitlements {
  const { data: session, status } = useSession();

  const isAuthenticated = status === "authenticated";
  const isGuest = !isAuthenticated;

  // For now, all authenticated users are "pro"
  // Later: check session.user.subscriptionTier
  const isPro = isAuthenticated;
  const isEnterprise = false; // Future: check tier

  return {
    // Auth state
    isGuest,
    isAuthenticated,

    // Subscription tier
    isPro,
    isEnterprise,

    // Feature flags
    canSync: isAuthenticated, // Sync requires auth
    canShare: isAuthenticated, // Sharing requires auth
    canExport: true, // Export available to all (local files)
    canImport: isAuthenticated, // Import requires auth (writes to server)
    canCollaborate: isEnterprise, // Team features require enterprise

    // Limits
    maxLibrarySize: isPro ? -1 : 100, // Pro: unlimited, Free: 100 items
  };
}

/**
 * Desktop/Mobile hook variant (uses auth state instead of useSession)
 */
export function useEntitlementsNative(): Entitlements {
  // Import auth state from packages/data/src/auth.ts
  const { isAuthenticated } = require("../auth");

  const isGuest = !isAuthenticated();
  const authed = isAuthenticated();

  const isPro = authed;
  const isEnterprise = false;

  return {
    isGuest,
    isAuthenticated: authed,
    isPro,
    isEnterprise,
    canSync: authed,
    canShare: authed,
    canExport: true,
    canImport: authed,
    canCollaborate: isEnterprise,
    maxLibrarySize: isPro ? -1 : 100,
  };
}
