/**
 * Telemetry - Structured Logging for DeepRecall
 *
 * Usage:
 *   import { logger } from "@deeprecall/telemetry";
 *   logger.info("db.local", "Transaction committed", { writes: 5, durationMs: 12 });
 *
 * Compile-time guards (esbuild/vite define):
 *   if (__LOG_DB_LOCAL__) {
 *     logger.debug("db.local", "Query executed", { rows, ms });
 *   }
 */

export type Level = "debug" | "info" | "warn" | "error";

export type Domain =
  | "db.local"
  | "db.postgres"
  | "sync.writeBuffer"
  | "sync.electric"
  | "sync.coordination"
  | "cas"
  | "blob.upload"
  | "blob.download"
  | "blob.bridge"
  | "server.api"
  | "api.dojo"
  | "pdf"
  | "ink"
  | "whiteboard"
  | "srs"
  | "auth"
  | "network"
  | "ui"
  | "console";

export interface LogEvent {
  ts: number;
  level: Level;
  domain: Domain;
  msg: string;
  data?: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
}

export interface Sink {
  write: (e: LogEvent) => void;
  flush?: () => Promise<void>;
}

let sinks: Sink[] = [];

export function registerSinks(...s: Sink[]) {
  sinks = s;
}

export function log(e: LogEvent) {
  for (const s of sinks) s.write(e);
}

// Convenience helpers
export const logger = {
  debug(domain: Domain, msg: string, data?: Record<string, unknown>) {
    log({ ts: Date.now(), level: "debug", domain, msg, data });
  },
  info(domain: Domain, msg: string, data?: Record<string, unknown>) {
    log({ ts: Date.now(), level: "info", domain, msg, data });
  },
  warn(domain: Domain, msg: string, data?: Record<string, unknown>) {
    log({ ts: Date.now(), level: "warn", domain, msg, data });
  },
  error(domain: Domain, msg: string, data?: Record<string, unknown>) {
    log({ ts: Date.now(), level: "error", domain, msg, data });
  },
};

/**
 * Hijack console for development (mirrors console.* to logger)
 * Returns restore function
 */
export function hijackConsole(domain: Domain = "ui") {
  const orig = { ...console };
  console.log = (...args) => {
    orig.log(...args);
    logger.debug(domain, args[0]?.toString() ?? "log", { args });
  };
  console.warn = (...args) => {
    orig.warn(...args);
    logger.warn(domain, args[0]?.toString() ?? "warn", { args });
  };
  console.error = (...args) => {
    orig.error(...args);
    logger.error(domain, args[0]?.toString() ?? "error", { args });
  };
  return () => Object.assign(console, orig);
}
