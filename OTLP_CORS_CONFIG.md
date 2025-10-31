# OpenTelemetry Collector CORS Configuration

## Problem

The OTLP HTTP endpoint needs to accept cross-origin requests from the web app during local development (and potentially from deployed web apps on different domains).

## Solution

Update the OpenTelemetry Collector configuration on Railway to include CORS settings.

### Option 1: Update Collector Config (Recommended)

Add CORS configuration to the OTLP HTTP receiver in your Railway environment variable `OTEL_CONFIG`:

```json
{
  "receivers": {
    "otlp": {
      "protocols": {
        "http": {
          "endpoint": "0.0.0.0:4318",
          "cors": {
            "allowed_origins": [
              "http://localhost:3000",
              "http://localhost:3001",
              "https://*.railway.app",
              "https://your-production-domain.com"
            ],
            "allowed_headers": ["*"],
            "max_age": 7200
          }
        }
      }
    }
  },
  "processors": {
    "batch": {}
  },
  "exporters": {
    "otlphttp/loki": {
      "endpoint": "https://<your-loki-public-domain>/otlp"
    }
  },
  "service": {
    "pipelines": {
      "logs": {
        "receivers": ["otlp"],
        "processors": ["batch"],
        "exporters": ["otlphttp/loki"]
      }
    }
  }
}
```

### Option 2: Disable OTLP in Local Dev (Current Workaround)

For now, we've made OTLP failures silent in development. Logs are still captured in the local ring buffer and can be viewed at `/admin/logs`.

To disable OTLP entirely in local dev:

```bash
# apps/web/.env.local
NEXT_PUBLIC_ENABLE_OTLP=false
```

### Option 3: Use Server-Side Proxy (Alternative)

Create an API route that proxies OTLP requests server-side:

```typescript
// apps/web/app/api/telemetry/otlp/route.ts
export async function POST(req: Request) {
  const body = await req.json();

  const response = await fetch(
    "https://opentelemetry-collector-contrib-production-700b.up.railway.app/v1/logs",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  return new Response(response.body, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
```

Then update the OTLP endpoint in `.env.local`:

```bash
NEXT_PUBLIC_OTLP_ENDPOINT=/api/telemetry/otlp
```

## Current Status

- ✅ OTLP sink handles CORS errors gracefully (silent in prod, reduced spam in dev)
- ✅ Logs are always saved in local ring buffer
- ✅ `/admin/logs` page works regardless of OTLP connectivity
- ⏳ CORS config needs to be added to Railway OpenTelemetry Collector

## Testing

After updating the collector config:

1. Restart the OpenTelemetry Collector service on Railway
2. Run the test script: `node test-otlp.js`
3. Check browser Network tab for successful POST requests
4. Verify logs appear in Grafana within 30 seconds
