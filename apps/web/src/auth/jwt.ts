/**
 * JWT Utilities for App Authentication
 *
 * Handles signing and verification of:
 * - App JWTs (1-6h, for desktop/mobile authentication)
 * - Electric replication tokens (5-15min, for sync)
 */

import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";

const APP_JWT_SECRET = new TextEncoder().encode(
  process.env.APP_JWT_SECRET || "dev-secret-change-in-production"
);

const ELECTRIC_TOKEN_SECRET = new TextEncoder().encode(
  process.env.ELECTRIC_TOKEN_SECRET || "dev-secret-change-in-production"
);

export interface AppJWTPayload {
  userId: string;
  provider: "google" | "github";
  deviceId: string;
  iat?: number;
  exp?: number;
}

export interface ElectricTokenPayload {
  userId: string;
  deviceId: string;
  iat?: number;
  exp?: number;
}

/**
 * Sign an app JWT for desktop/mobile authentication
 * Used after provider token exchange
 */
export async function signAppJWT(
  payload: Omit<AppJWTPayload, "iat" | "exp">,
  options: { expiresIn?: string } = {}
): Promise<string> {
  const { expiresIn = "6h" } = options;

  const jwt = await new SignJWT({
    userId: payload.userId,
    provider: payload.provider,
    deviceId: payload.deviceId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("deeprecall")
    .setAudience("deeprecall-app")
    .setExpirationTime(expiresIn)
    .sign(APP_JWT_SECRET);

  return jwt;
}

/**
 * Verify and decode an app JWT
 */
export async function verifyAppJWT(token: string): Promise<AppJWTPayload> {
  const { payload } = await jwtVerify(token, APP_JWT_SECRET, {
    issuer: "deeprecall",
    audience: "deeprecall-app",
  });

  return payload as unknown as AppJWTPayload;
}

/**
 * Sign a short-lived Electric replication token
 * Contains userId + deviceId for RLS enforcement
 */
export async function signElectricToken(
  payload: Omit<ElectricTokenPayload, "iat" | "exp">,
  options: { expiresIn?: string } = {}
): Promise<string> {
  const { expiresIn = "15m" } = options;

  const jwt = await new SignJWT({
    userId: payload.userId,
    deviceId: payload.deviceId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("deeprecall")
    .setAudience("deeprecall-electric")
    .setExpirationTime(expiresIn)
    .sign(ELECTRIC_TOKEN_SECRET);

  return jwt;
}

/**
 * Verify and decode an Electric replication token
 */
export async function verifyElectricToken(
  token: string
): Promise<ElectricTokenPayload> {
  const { payload } = await jwtVerify(token, ELECTRIC_TOKEN_SECRET, {
    issuer: "deeprecall",
    audience: "deeprecall-electric",
  });

  return payload as unknown as ElectricTokenPayload;
}

/**
 * Derive pseudonymous actor_uid for logging
 * HMAC(SECRET, provider:sub) → base64url
 */
export function deriveActorUid(provider: string, sub: string): string {
  const secret = process.env.ACTOR_HMAC_SECRET || "dev-hmac-secret";
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${provider}:${sub}`);
  return hmac.digest("base64url");
}

/**
 * Parse JWT without verification (for checking expiry client-side)
 */
export function parseJWTUnsafe(token: string): any {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const payload = Buffer.from(parts[1], "base64url").toString("utf8");
  return JSON.parse(payload);
}
