# Mobile App Quick Start

## Local Development (Browser)

Run the mobile app in your browser with automatic connection to local web server:

```bash
# Terminal 1: Start the web server
cd apps/web
pnpm run dev

# Terminal 2: Start the mobile app
cd apps/mobile
pnpm run dev:mobile
```

**What happens:**

- Mobile app runs in browser at `http://localhost:5173`
- All `/api` requests are proxied to `localhost:3000` (web server)
- Electric syncs from cloud (`https://api.electric-sql.cloud`)
- Changes sync between web and mobile in real-time

## Production Build (iOS Device)

Build for deployment to a physical iOS device:

### 1. Configure Production URL

Edit `apps/mobile/.env.local`:

```bash
# Uncomment and set your Railway URL
VITE_API_BASE_URL=https://your-app.railway.app
```

### 2. Build and Deploy

```bash
cd apps/mobile

# Build for production
pnpm run build:ios

# Sync with iOS project
pnpm run cap:sync

# Open in Xcode
pnpm run cap:open:ios
```

### 3. Run on Device

In Xcode:

1. Select your connected iOS device
2. Click Run (⌘R)
3. App will use Railway API for all requests

## How It Works

The app automatically detects the environment:

| Mode            | Command               | API URL             | How It Works                    |
| --------------- | --------------------- | ------------------- | ------------------------------- |
| **Development** | `pnpm run dev:mobile` | `localhost:3000`    | Vite proxy forwards requests    |
| **Production**  | `pnpm run build:ios`  | `VITE_API_BASE_URL` | Direct HTTP requests to Railway |

## Troubleshooting

### "Network request failed" in development

**Cause:** Web server not running

**Solution:**

```bash
cd apps/web
pnpm run dev
```

### "Network request failed" on iOS device

**Cause:** `VITE_API_BASE_URL` not set or incorrect

**Solution:**

1. Check `.env.local` has correct Railway URL
2. Rebuild: `pnpm run build:ios`
3. Re-sync: `pnpm run cap:sync`

### Changes not syncing between web and mobile

**Cause:** Different Electric credentials or database

**Solution:**

- Verify both apps use same Electric URL/credentials
- Check both apps connect to same Postgres database

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Development Mode (Browser)                         │
│                                                      │
│  Mobile App (localhost:5173)                        │
│       ↓ /api/* requests                             │
│  Vite Proxy                                         │
│       ↓ forwards to                                 │
│  Web Server (localhost:3000)                        │
│       ↓ writes to                                   │
│  Postgres (Neon Cloud)                              │
│       ↓ syncs via                                   │
│  Electric Cloud → IndexedDB (both apps)             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Production Mode (iOS Device)                       │
│                                                      │
│  Mobile App (iOS)                                   │
│       ↓ direct HTTPS                                │
│  Railway Server (your-app.railway.app)              │
│       ↓ writes to                                   │
│  Postgres (Neon Cloud)                              │
│       ↓ syncs via                                   │
│  Electric Cloud → IndexedDB (both apps)             │
└─────────────────────────────────────────────────────┘
```

## Next Steps

- See `README_ENVIRONMENT.md` for detailed configuration
- Check `src/config/api.ts` for implementation details
- Review `.env.local.example` for all available options
