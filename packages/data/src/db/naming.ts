/**
 * @deeprecall/data - Database Name Manager
 *
 * Manages dynamic database naming for guest vs authenticated users.
 *
 * Pattern:
 * - Guest: deeprecall_guest_<deviceId>
 * - User: deeprecall_<userId>_<deviceId>
 *
 * This allows clean separation between guest and user data,
 * prevents cross-tenant leaks, and enables easy DB switching on auth state changes.
 */

import { getUserId, getAuthDeviceId } from "../auth";
import { getDeviceId as getPersistentDeviceId } from "../utils/deviceId";
import { logger } from "@deeprecall/telemetry";

/**
 * Get the database name based on current auth state
 *
 * @returns Database name string
 */
export function getDatabaseName(): string {
  const userId = getUserId();
  const authDeviceId = getAuthDeviceId();

  // Prefer device ID from auth state, fall back to persistent device ID
  const deviceId = authDeviceId || getPersistentDeviceId();

  if (userId) {
    // Authenticated user: include user ID for tenant isolation
    const dbName = `deeprecall_${sanitizeId(userId)}_${sanitizeId(deviceId)}`;
    logger.debug("db.local", "Database name (authenticated)", {
      dbName: "***",
    });
    return dbName;
  } else {
    // Guest: use guest prefix
    const dbName = `deeprecall_guest_${sanitizeId(deviceId)}`;
    logger.debug("db.local", "Database name (guest)", { dbName });
    return dbName;
  }
}

/**
 * Sanitize an ID for use in database name
 * Removes or replaces characters that might cause issues
 *
 * @param id - The ID to sanitize
 * @returns Sanitized ID safe for database names
 */
function sanitizeId(id: string): string {
  // Keep alphanumeric, hyphens, and underscores
  // Replace other characters with underscore
  return id.replace(/[^a-zA-Z0-9\-_]/g, "_");
}

/**
 * Check if we need to switch databases based on auth state
 *
 * @param currentDbName - The current database name
 * @returns true if DB switch is needed, false otherwise
 */
export function shouldSwitchDatabase(currentDbName: string): boolean {
  const expectedName = getDatabaseName();
  const needsSwitch = currentDbName !== expectedName;

  if (needsSwitch) {
    logger.info("db.local", "Database switch required", {
      current: currentDbName,
      expected: expectedName,
    });
  }

  return needsSwitch;
}
