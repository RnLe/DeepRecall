#!/usr/bin/env node
/**
 * Test OTLP endpoint connectivity
 * Usage: node test-otlp.js
 */

const OTLP_ENDPOINT =
  "https://opentelemetry-collector-contrib-production-700b.up.railway.app/v1/logs";

const testEvent = {
  resourceLogs: [
    {
      resource: {
        attributes: [
          { key: "app", value: { stringValue: "deeprecall" } },
          { key: "platform", value: { stringValue: "test" } },
          { key: "env", value: { stringValue: "development" } },
        ],
      },
      scopeLogs: [
        {
          logRecords: [
            {
              timeUnixNano: String(Date.now() * 1e6),
              severityText: "INFO",
              body: { stringValue: "ui | Test log from DeepRecall" },
              attributes: [
                { key: "domain", value: { stringValue: "ui" } },
                { key: "test", value: { stringValue: "true" } },
                {
                  key: "timestamp",
                  value: { stringValue: new Date().toISOString() },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

console.log("🧪 Testing OTLP endpoint...");
console.log(`📡 Endpoint: ${OTLP_ENDPOINT}`);
console.log(`📦 Payload size: ${JSON.stringify(testEvent).length} bytes`);
console.log("");

fetch(OTLP_ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(testEvent),
})
  .then((res) => {
    console.log(`✅ Response Status: ${res.status} ${res.statusText}`);
    return res.text();
  })
  .then((body) => {
    console.log(`📄 Response Body: ${body || "(empty)"}`);
    console.log("");
    console.log("✅ SUCCESS! OTLP endpoint is reachable.");
    console.log("");
    console.log("Next steps:");
    console.log(
      "1. Check Grafana dashboard: https://grafana-production-aca8.up.railway.app"
    );
    console.log("2. Login with your admin credentials");
    console.log("3. Go to Explore → Select Loki data source");
    console.log('4. Run query: {app="deeprecall", env="development"}');
    console.log("5. You should see the test log appear within 30 seconds");
  })
  .catch((err) => {
    console.error("❌ FAILED:", err.message);
    console.log("");
    console.log("Troubleshooting:");
    console.log("1. Check if OpenTelemetry Collector is running on Railway");
    console.log("2. Verify the endpoint URL is correct");
    console.log("3. Check Railway service logs for errors");
  });
