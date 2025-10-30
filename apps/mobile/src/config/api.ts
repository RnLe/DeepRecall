/**
 * API Configuration for Mobile App
 *
 * Automatically detects environment and uses appropriate API URL:
 * - Development (pnpm run dev:mobile): http://localhost:3000
 * - Production (iOS device): Railway URL from env
 *
 * Usage:
 * ```ts
 * import { getApiBaseUrl } from '@/config/api';
 *
 * const response = await fetch(`${getApiBaseUrl()}/api/admin/sync-blob`, { ... });
 * ```
 */

/**
 * Get API base URL based on current environment
 *
 * @returns API base URL without trailing slash
 */
export function getApiBaseUrl(): string {
  // In development mode (pnpm run dev:mobile), use Vite proxy
  // The proxy forwards /api requests to localhost:3000
  if (import.meta.env.DEV) {
    return ""; // Empty string means same-origin (Vite dev server with proxy)
  }

  // In production mode (built iOS app), use configured URL
  // Falls back to localhost if not set (though this won't work on physical device)
  const configuredUrl =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

  // Remove trailing slash if present
  return configuredUrl.replace(/\/$/, "");
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV;
}

/**
 * Check if running in production mode (built iOS app)
 */
export function isProduction(): boolean {
  return import.meta.env.PROD;
}

/**
 * Get environment info for debugging
 */
export function getEnvironmentInfo() {
  return {
    mode: import.meta.env.MODE,
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
    apiBaseUrl: getApiBaseUrl(),
    configuredUrl: import.meta.env.VITE_API_BASE_URL,
    electricUrl: import.meta.env.VITE_ELECTRIC_URL,
  };
}
