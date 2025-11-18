/**
 * @deeprecall/data
 * Client-side data layer for DeepRecall
 * Includes Dexie database, repositories, and UI stores
 */

export * from "./db";
export * from "./repos";
export * from "./stores";
export * from "./hooks";
export * from "./utils";
export * from "./types/unified"; // Unified blob handle

// Export Electric sync and write buffer
export * from "./electric";
export * from "./writeBuffer";

// Export auth state management and guest upgrade
export * from "./auth";
export { upgradeGuestToUser } from "./auth/upgradeGuest";
export { hasGuestData } from "./guest-upgrade";
export { isNewAccount, wipeGuestData } from "./auth/accountStatus";
export { handleSignIn, handleSignOut, debugAccountStatus } from "./auth/flows";
export type { SignInResult, SignOutResult } from "./auth/flows";

// Export auth cleanup and initialization utilities
export {
  clearAllUserData,
  clearCASStorage,
  initializeGuestMode,
} from "./auth/cleanupAndInit";

// Export CAS integrity checking
export {
  checkCASIntegrity,
  getMissingBlobs,
  scanAndCheckCAS,
} from "./utils/casIntegrityCheck";
export type { IntegrityCheckResult } from "./utils/casIntegrityCheck";

// Export preset initialization
export { initializePresets } from "./repos/presets.init";
