/**
 * Telemetry initialization for DeepRecall Mobile (Capacitor)
 *
 * Dev: Console + Ring Buffer (4000 events)
 * Prod: Ring Buffer only (silent unless OTLP enabled via env)
 */
import { registerSinks, type Sink } from "@deeprecall/telemetry";
import {
  makeRingBufferSink,
  makeConsoleSink,
  makeOtlpHttpSink,
  type RingBufferSink,
} from "@deeprecall/telemetry/sinks";

let ringBuffer: RingBufferSink | null = null;

export function initTelemetry() {
  if (ringBuffer) return; // Already initialized

  ringBuffer = makeRingBufferSink(4000);

  const sinks: Sink[] = [ringBuffer];

  // Dev: Add filtered console sink (optional, controlled by env var)
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_ENABLE_CONSOLE_LOGS !== "false"
  ) {
    // Get console log level from env (default: "warn")
    const consoleLevel = (import.meta.env.VITE_CONSOLE_LOG_LEVEL || "warn") as
      | "debug"
      | "info"
      | "warn"
      | "error";

    // Get verbose mode from env (default: false)
    const consoleVerbose = import.meta.env.VITE_CONSOLE_VERBOSE === "true";

    // Configure console output - reduce noise by default
    sinks.push(
      makeConsoleSink({
        minLevel: consoleLevel, // Control via VITE_CONSOLE_LOG_LEVEL
        excludeDomains: [
          // Uncomment to exclude specific noisy domains:
          // "sync.electric", // Electric shape updates
          // "sync.writeBuffer", // Write buffer operations
          // "db.local", // Local database operations
        ],
        verbose: consoleVerbose, // Compact by default, verbose if enabled
      })
    );
  }

  // OTLP sink (optional, for testing/production)
  // Enable in dev by setting VITE_ENABLE_OTLP=true in .env.local
  if (import.meta.env.VITE_ENABLE_OTLP === "true") {
    const endpoint =
      import.meta.env.VITE_OTLP_ENDPOINT ||
      "https://opentelemetry-collector-contrib-production-700b.up.railway.app/v1/logs";

    sinks.push(
      makeOtlpHttpSink(endpoint, {
        app: "deeprecall",
        platform: "mobile",
        env: import.meta.env.MODE || "development",
      })
    );
  }

  registerSinks(...sinks);
}

export function getRingBuffer(): RingBufferSink {
  if (!ringBuffer) {
    throw new Error("Telemetry not initialized. Call initTelemetry() first.");
  }
  return ringBuffer;
}
