/**
 * Telemetry initialization for DeepRecall Web
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
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ENABLE_CONSOLE_LOGS !== "false"
  ) {
    // Get console log level from env (default: "warn")
    const consoleLevel = (process.env.NEXT_PUBLIC_CONSOLE_LOG_LEVEL ||
      "warn") as "debug" | "info" | "warn" | "error";

    // Get verbose mode from env (default: false)
    const consoleVerbose = process.env.NEXT_PUBLIC_CONSOLE_VERBOSE === "true";

    // Configure console output - reduce noise by default
    sinks.push(
      makeConsoleSink({
        minLevel: consoleLevel, // Control via NEXT_PUBLIC_CONSOLE_LOG_LEVEL
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
  // Enable in dev by setting NEXT_PUBLIC_ENABLE_OTLP=true in .env.local
  if (process.env.NEXT_PUBLIC_ENABLE_OTLP === "true") {
    const endpoint =
      process.env.NEXT_PUBLIC_OTLP_ENDPOINT ||
      "https://opentelemetry-collector-contrib-production-700b.up.railway.app/v1/logs";

    sinks.push(
      makeOtlpHttpSink(endpoint, {
        app: "deeprecall",
        platform: "web",
        env: process.env.NODE_ENV || "development",
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
