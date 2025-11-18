import { getApiBaseUrl } from "../config/api";

/**
 * Resolve the Electric sync URL for mobile clients.
 *
 * Priority:
 * 1. Explicit VITE_ELECTRIC_URL (production builds)
 * 2. API base URL + /api/electric/v1/shape (ensures proxy usage)
 */
export function resolveElectricUrl(): string {
  const configured = import.meta.env.VITE_ELECTRIC_URL?.trim();
  if (configured && configured.length > 0) {
    return configured.replace(/\/$/, "");
  }

  const apiBase = getApiBaseUrl();
  return `${apiBase.replace(/\/$/, "")}/api/electric/v1/shape`;
}
