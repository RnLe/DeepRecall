import type { LogEvent, Sink, Level, Domain } from "../logger";

export interface ConsoleSinkOptions {
  /** Minimum level to log (default: debug) */
  minLevel?: Level;
  /** Domains to include (default: all) */
  includeDomains?: Domain[];
  /** Domains to exclude (default: none) */
  excludeDomains?: Domain[];
  /** Verbose mode: include full data objects (default: false) */
  verbose?: boolean;
}

const levelPriority: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Console sink for development with filtering
 *
 * Usage:
 *   makeConsoleSink() // All logs
 *   makeConsoleSink({ minLevel: "info" }) // Info and above
 *   makeConsoleSink({ excludeDomains: ["sync.electric"] }) // Exclude noisy domains
 */
export function makeConsoleSink(options: ConsoleSinkOptions = {}): Sink {
  const {
    minLevel = "debug",
    includeDomains,
    excludeDomains = [],
    verbose = false,
  } = options;

  const minPriority = levelPriority[minLevel];

  return {
    write(e: LogEvent) {
      // Filter by level
      if (levelPriority[e.level] < minPriority) return;

      // Filter by domain
      if (includeDomains && !includeDomains.includes(e.domain)) return;
      if (excludeDomains.includes(e.domain)) return;

      const method = e.level === "debug" ? "log" : e.level;

      if (verbose && e.data && Object.keys(e.data).length > 0) {
        // Verbose: show full data
        // eslint-disable-next-line no-console
        console[method](`[${e.domain}] ${e.msg}`, e.data);
      } else if (e.data && Object.keys(e.data).length > 0) {
        // Compact: show data count only
        const dataCount = Object.keys(e.data).length;
        // eslint-disable-next-line no-console
        console[method](`[${e.domain}] ${e.msg} (${dataCount} fields)`);
      } else {
        // No data
        // eslint-disable-next-line no-console
        console[method](`[${e.domain}] ${e.msg}`);
      }
    },
  };
}

/**
 * Default console sink (backwards compatible)
 */
export const consoleSink: Sink = makeConsoleSink();
