# Mobile App Environment Setup

## Overview

The mobile app automatically detects whether it's running in **development** or **production** mode and configures the API URL accordingly.

## How It Works

### Development Mode (`pnpm run dev:mobile`)

When you run the app locally in your browser:

- **Vite proxy** forwards all `/api` requests to `localhost:3000`
- The app automatically uses an empty API base URL (same-origin requests)
- You must have the Next.js web server running on `localhost:3000`

**Required setup:**

```bash
# Terminal 1: Run web server
cd apps/web
pnpm run dev

# Terminal 2: Run mobile app
cd apps/mobile
pnpm run dev:mobile
```

### Production Mode (iOS Device)

When building for production:

- The app uses `VITE_API_BASE_URL` from `.env.local`
- This should point to your Railway deployment (e.g., `https://your-app.railway.app`)
- Physical devices can't access `localhost`, so they need the production URL

**Required setup:**

1. Update `.env.local` with your Railway URL:

   ```bash
   VITE_API_BASE_URL=https://your-app.railway.app
   ```

2. Build and deploy:
   ```bash
   pnpm run build:ios
   pnpm run cap:sync
   pnpm run cap:open:ios
   ```

## Configuration Files

### `.env.local`

```bash
# For development: Leave VITE_API_BASE_URL commented
# For production: Set to your Railway URL
VITE_API_BASE_URL=https://your-app.railway.app

# Electric Cloud credentials (proxied through your API)
# Use https://<your-api-domain>/api/electric/v1/shape to avoid CORS issues
VITE_ELECTRIC_URL=https://your-app.railway.app/api/electric/v1/shape
VITE_ELECTRIC_SOURCE_ID=...
VITE_ELECTRIC_SOURCE_SECRET=...
```

### `vite.config.ts`

```typescript
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
```

### `src/config/api.ts`

Centralized API configuration utility that automatically detects the environment:

```typescript
import { getApiBaseUrl } from './config/api';

// Automatically returns:
// - '' (empty string) in development → uses Vite proxy
// - Railway URL in production → from VITE_API_BASE_URL
const response = await fetch(`${getApiBaseUrl()}/api/admin/sync-blob`, { ... });
```

## Common Issues

### Issue: "Failed to fetch" in development

**Solution:** Make sure the Next.js web server is running on `localhost:3000`

### Issue: Electric Cloud CORS errors

**Solution:** Make sure `VITE_ELECTRIC_URL` points to your backend proxy (`https://<api-domain>/api/electric/v1/shape`). Direct calls to `https://api.electric-sql.cloud` from Capacitor/WebView origins will be blocked by CORS.

### Issue: "Failed to resolve module specifier '@capacitor/preferences'"

**This is expected in browser mode.** The device ID code attempts a dynamic import of Capacitor, fails gracefully, and falls back to localStorage. Device IDs initialize correctly and this warning can be ignored

### Issue: "Failed to fetch" on iOS device

**Solution:** Update `VITE_API_BASE_URL` in `.env.local` to your Railway URL

### Issue: API requests not proxied in development

**Solution:** Verify `vite.config.ts` has the `/api` proxy configuration

## Debugging

Check the current environment configuration:

```typescript
import { getEnvironmentInfo } from "./config/api";

console.log(getEnvironmentInfo());
// {
//   mode: 'development',
//   isDev: true,
//   isProd: false,
//   apiBaseUrl: '',
//   configuredUrl: undefined,
//   electricUrl: 'https://your-app.railway.app/api/electric/v1/shape'
// }
```

## Scripts

- `pnpm run dev:mobile` - Run in browser (development mode, uses proxy)
- `pnpm run build:ios` - Build for production iOS
- `pnpm run cap:sync` - Sync web assets with iOS project
- `pnpm run cap:open:ios` - Open in Xcode
