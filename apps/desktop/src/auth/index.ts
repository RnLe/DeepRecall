/**
 * Desktop authentication module exports
 * Centralized exports for all auth-related functionality
 */

// OAuth flows
export { signInWithGoogle, refreshGoogleSession } from "./google";
export type { GoogleAuthResult } from "./google";

export { signInWithGitHub, refreshGitHubSession } from "./github";
export type { GitHubAuthResult, DeviceCodeResponse } from "./github";

// Session management
export {
  initializeSession,
  refreshSession,
  getElectricToken,
  clearSession,
  getOrCreateDeviceId,
  parseJWTUnsafe,
  isJWTExpired,
} from "./session";
export type { SessionInfo } from "./session";

// Secure storage
export { secureStore, tokens } from "./secure-store";
export type { SecureStore } from "./secure-store";

// OAuth utilities
export {
  generatePKCE,
  startLoopbackListener,
  parseQueryParams,
} from "./oauth-utils";

// Test utilities (dev only)
export {
  testGoogleOAuth,
  testGitHubOAuth,
  testSessionRefresh,
  testClearSession,
  testKeychain,
  showSession,
} from "./test-oauth";
