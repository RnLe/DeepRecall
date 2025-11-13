/**
 * @deeprecall/data - Auth State Management
 *
 * Global authentication state for guest mode vs authenticated user.
 * This module provides a simple interface to check auth status and
 * is used by repository methods to conditionally enqueue server writes.
 *
 * Pattern:
 * - Guest users: Full local functionality, no server writes
 * - Authenticated users: Local + server sync via WriteBuffer
 */

import { logger } from "@deeprecall/telemetry";

/**
 * Global auth state
 * Set by app providers on mount and auth state changes
 */
let _isAuthenticated = false;
let _userId: string | null = null;
let _deviceId: string | null = null;

/**
 * Auth state change listeners
 * Used by React components to re-render when auth state changes
 */
type AuthStateListener = () => void;
const _listeners = new Set<AuthStateListener>();

/**
 * Subscribe to auth state changes
 *
 * @param listener - Function to call when auth state changes
 * @returns Unsubscribe function
 */
export function subscribeToAuthState(listener: AuthStateListener): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/**
 * Set the global authentication state
 *
 * Called by app providers (web/desktop/mobile) on:
 * - Initial mount (check for existing session)
 * - Sign in success
 * - Sign out
 *
 * @param authenticated - Whether user is signed in
 * @param userId - User ID from session (null if guest)
 * @param deviceId - Persistent device UUID
 */
export function setAuthState(
  authenticated: boolean,
  userId: string | null,
  deviceId: string | null = null
): void {
  const wasAuthenticated = _isAuthenticated;
  _isAuthenticated = authenticated;
  _userId = userId;
  _deviceId = deviceId;

  logger.info("auth", "Auth state updated", {
    authenticated,
    userId: userId ? "***" : null, // Don't log actual userId
    deviceId: deviceId ? "***" : null,
    transition: wasAuthenticated !== authenticated,
  });

  // Notify all listeners of the change
  _listeners.forEach((listener) => listener());
}

/**
 * Check if user is authenticated
 *
 * Returns true if user has signed in, false for guest mode.
 * Used by repository methods to conditionally enqueue server writes.
 *
 * @returns true if authenticated, false if guest
 */
export function isAuthenticated(): boolean {
  return _isAuthenticated;
}

/**
 * Get the current user ID
 *
 * @returns User ID string if authenticated, null if guest
 */
export function getUserId(): string | null {
  return _userId;
}

/**
 * Get the current device ID from auth state
 *
 * Note: This returns the device ID stored in auth state.
 * For the persistent device ID, use getDeviceId() from utils/deviceId.ts
 *
 * @returns Device ID string if set, null otherwise
 */
export function getAuthDeviceId(): string | null {
  return _deviceId;
}

/**
 * Get full auth context
 *
 * Useful for components that need all auth state at once
 */
export function getAuthContext() {
  return {
    isAuthenticated: _isAuthenticated,
    userId: _userId,
    deviceId: _deviceId,
  };
}
