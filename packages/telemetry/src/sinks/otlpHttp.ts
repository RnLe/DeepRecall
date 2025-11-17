import type { LogEvent, Sink } from "../logger";

/**
 * OTLP HTTP sink for production aggregation (opt-in)
 *
 * Batches log events and sends to OpenTelemetry Collector via OTLP/HTTP
 */
export function makeOtlpHttpSink(
  endpoint = "https://opentelemetry-collector-contrib-production-700b.up.railway.app/v1/logs",
  resource: Record<string, string> = {}
): Sink {
  let queue: LogEvent[] = [];
  let inflight = false;

  // Ensure service_name is always set (fixes "unknown_service" issue)
  const resourceWithDefaults = {
    service_name: "deeprecall",
    ...resource,
  };

  async function flushBatch() {
    if (inflight || queue.length === 0) return;
    inflight = true;
    const batch = queue.splice(0, Math.min(queue.length, 200));

    const body = {
      resourceLogs: [
        {
          resource: {
            attributes: Object.entries(resourceWithDefaults).map(([k, v]) => ({
              key: k,
              value: { stringValue: String(v) },
            })),
          },
          scopeLogs: [
            {
              logRecords: batch.map((e) => ({
                timeUnixNano: String(e.ts * 1e6),
                severityText: e.level.toUpperCase(),
                body: { stringValue: `${e.domain} | ${e.msg}` },
                attributes: [
                  { key: "domain", value: { stringValue: e.domain } },
                  ...(e.traceId
                    ? [{ key: "traceId", value: { stringValue: e.traceId } }]
                    : []),
                  ...(e.spanId
                    ? [{ key: "spanId", value: { stringValue: e.spanId } }]
                    : []),
                  ...Object.entries(e.data ?? {}).map(([k, v]) => ({
                    key: k,
                    value: {
                      stringValue:
                        typeof v === "string" ? v : JSON.stringify(v),
                    },
                  })),
                ],
              })),
            },
          ],
        },
      ],
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Include origin header for CORS
        },
        keepalive: true,
        body: JSON.stringify(body),
        // Don't include credentials for CORS
        credentials: "omit",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      // Silent fail in production, avoid logging loops
      // In dev, only log CORS/network errors once per batch to avoid spam
      if (process.env.NODE_ENV === "development") {
        const isNetworkError =
          error instanceof TypeError && error.message.includes("fetch");
        const isCorsError =
          error instanceof TypeError && error.message.includes("CORS");

        if (isNetworkError || isCorsError) {
          // Only log once every 10 batches to reduce console spam
          if (Math.random() < 0.1) {
            console.warn(
              "[OTLP] Cannot reach collector (this is OK in local dev). " +
                "Logs are still saved locally in ring buffer. " +
                "To test full pipeline, ensure Railway services are running."
            );
          }
        } else {
          console.error("[OTLP] Failed to send logs:", error);
        }
      }
    } finally {
      inflight = false;
    }
  }

  return {
    write(e: LogEvent) {
      queue.push(e);
      if (queue.length >= 50) void flushBatch();
    },
    async flush() {
      await flushBatch();
    },
  };
}
