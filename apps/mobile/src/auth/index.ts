/**
 * Mobile authentication module
 * Public API for OAuth and session management
 */

export { signInWithGoogle } from "./google";
export {
  signInWithGitHub,
  openGitHubVerification,
  closeBrowser,
} from "./github";
export {
  loadSession,
  saveSession,
  clearSession,
  getOrCreateDeviceId,
  parseJWTUnsafe,
  isJWTExpired,
  type SessionInfo,
  type AuthStatus,
} from "./session";
export { secureStore } from "./secure-store";
export { generatePKCE, generateState } from "./oauth-utils";
