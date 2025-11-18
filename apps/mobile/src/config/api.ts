/**
 * API Configuration for Mobile App
 *
 * Automatically resolves the API base URL for all environments.
 * Development builds now talk to the same deployed API as production to avoid
 * local Next.js dependencies. Configure via VITE_API_BASE_URL.
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
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const fallback = "https://deeprecall-production.up.railway.app";

  if (import.meta.env.DEV) {
    console.warn(
      "[config.api] VITE_API_BASE_URL is not set; falling back to production domain"
    );
  }

  return fallback;
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
