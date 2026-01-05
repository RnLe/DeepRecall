# Loki Setup for Railway

## Current Issues & Solutions

### 1. Permission Denied Error

**Error**: `mkdir fake: permission denied`

**Cause**: Loki is trying to write to `/fake` directory (hardcoded org_id) but doesn't have permissions.

**Solution**:

- Use the `loki-config.yaml` file in this repo
- Mount it to `/etc/loki/local-config.yaml` in Railway
- Ensure Loki has write permissions to `/loki` directory

### 2. Unknown Service Name

**Error**: `service_name="unknown_service"`

**Cause**: OTLP logs not sending proper service labels.

**Solution**: ✅ **FIXED** - Updated telemetry configuration to always include `service_name="deeprecall-web"`

### 3. No Logs in Grafana

**Causes**:

1. OTLP sink not enabled in production (was opt-in)
2. Loki permission errors preventing log storage
3. Missing service labels for filtering

**Solutions**:

- ✅ **FIXED** - OTLP sink now enabled by default in production
- Deploy `loki-config.yaml` to Railway (see below)
- Proper labels added to all logs

---

## Railway Deployment Steps

### 1. Deploy Loki Configuration

In your Railway Loki service:

1. **Add volume mount**:

 ```
 Mount Path: /loki
 ```

2. **Set environment variables**:

 ```bash
 LOKI_CONFIG_FILE=/etc/loki/local-config.yaml
 ```

3. **Upload configuration**:
 - Copy `loki-config.yaml` from this repo
 - In Railway dashboard: Settings → Raw Editor
 - Create a file at `/etc/loki/local-config.yaml` with the contents

 **OR** use Railway CLI:

 ```bash
 railway up loki-config.yaml:/etc/loki/local-config.yaml
 ```

4. **Restart Loki service** in Railway dashboard

### 2. Verify Logs are Flowing

After deployment:

1. **Check Loki logs** in Railway dashboard - should no longer see permission errors
2. **Open Grafana** → Explore → Select Loki datasource
3. **Run query**:
 ```logql
 {service_name="deeprecall-web"}
 ```
4. **You should see logs** from your production web app

### 3. Useful Log Queries

**All production logs**:

```logql
{service_name="deeprecall-web", deployment_environment="production"}
```

**Error logs only**:

```logql
{service_name="deeprecall-web"} |= "error"
```

**Auth flow logs**:

```logql
{service_name="deeprecall-web"} | json | domain = "auth"
```

**Sync issues**:

```logql
{service_name="deeprecall-web"} | json | domain =~ "sync.*"
```

---

## Development Testing

To test OTLP logging locally:

1. **Enable OTLP in development**:

 ```bash
 # In apps/web/.env.local
 NEXT_PUBLIC_ENABLE_OTLP=true
 ```

2. **Start local dev server**:

 ```bash
 cd apps/web
 pnpm dev
 ```

3. **Logs will be sent to Railway** (if services are running)

4. **Check console** for OTLP warnings (expected in local dev if Railway is unreachable)

---

## Log Levels

The web app now logs with these minimum levels:

- **Production**: All logs sent to Loki (debug, info, warn, error)
- **Console (dev only)**: `warn` and above by default
 - Override with `NEXT_PUBLIC_CONSOLE_LOG_LEVEL=debug` in `.env.local`
 - Enable verbose mode with `NEXT_PUBLIC_CONSOLE_VERBOSE=true`

---

## Troubleshooting

### Still seeing "permission denied"?

1. Check Loki has write access to `/loki` mount
2. Verify config file is at `/etc/loki/local-config.yaml`
3. Check Railway logs for Loki startup errors

### No logs in Grafana?

1. Verify OTLP endpoint is correct in Railway web service env vars
2. Check OpenTelemetry Collector is running
3. Run test query: `{service_name=~".+"}`

### "unknown_service" still appearing?

1. Redeploy web app after pulling latest code
2. Check Railway env vars don't override `service_name`
3. Verify telemetry initialization in app startup logs

---

## Architecture

```
DeepRecall Web App (Railway)
 ↓ (OTLP/HTTP)
OpenTelemetry Collector (Railway)
 ↓ (Loki Write API)
Loki (Railway)
 ↓ (Loki Query API)
Grafana (Railway)
```

**Key points**:

- Web app sends structured logs via OTLP protocol
- Collector transforms and batches logs
- Loki stores logs with labels for querying
- Grafana visualizes and searches logs
