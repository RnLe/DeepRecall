/**
 * Resolve the Electric sync URL for mobile clients.
 *
 * Priority:
 * 1. Explicit VITE_ELECTRIC_URL (production builds)
 * 2. API base URL + /api/electric/v1/shape (ensures proxy usage)
 * 3. Development fallback: http://localhost:3000/api/electric/v1/shape
 */
export function resolveElectricUrl(): string {
  const configured = import.meta.env.VITE_ELECTRIC_URL?.trim();
  if (configured && configured.length > 0) {
    return configured.replace(/\/$/, "");
  }

  const apiBaseCandidate =
    import.meta.env.VITE_API_BASE_URL?.trim() ||
    (import.meta.env.DEV ? "http://localhost:3000" : undefined) ||
    "https://deeprecall-production.up.railway.app";

  return `${apiBaseCandidate.replace(/\/$/, "")}/api/electric/v1/shape`;
}
