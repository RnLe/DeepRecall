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

  // Production: Always enable OTLP sink for error logging
  // Dev: Enable by setting NEXT_PUBLIC_ENABLE_OTLP=true in .env.local
  const shouldEnableOtlp =
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_ENABLE_OTLP === "true";

  if (shouldEnableOtlp) {
    const endpoint =
      process.env.NEXT_PUBLIC_OTLP_ENDPOINT ||
      "https://opentelemetry-collector-contrib-production-700b.up.railway.app/v1/logs";

    sinks.push(
      makeOtlpHttpSink(endpoint, {
        service_name: "deeprecall-web", // Proper service name (not "unknown_service")
        deployment_environment: process.env.NODE_ENV || "development",
        platform: "web",
        // Add Railway service ID if available
        ...(process.env.RAILWAY_SERVICE_ID && {
          railway_service_id: process.env.RAILWAY_SERVICE_ID,
        }),
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
