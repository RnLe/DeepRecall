# System State Management Implementation

## Overview

Implemented a comprehensive system state management framework using **Zustand** to handle global application states like connection status, sync health, and future settings/preferences.

## Architecture Decision: Why Zustand?

### Considered Options

1. **React Query** - Server state management
2. **Zustand** - Client state management ✅ **CHOSEN**

### Rationale

- **Mixed state types**: Need both system status (connection, sync) AND user preferences (theme, settings)
- **Event-driven model**: Connection status derives from events (navigator.onLine, Electric events), not HTTP requests
- **Lightweight**: ~1KB bundle size, critical for mobile/desktop apps
- **No provider overhead**: Works without context providers, easier to use across monorepo packages
- **Future-proof**: Settings, theme, UI state, feature flags all fit naturally

## Implementation Details

### 1. System Store (`packages/data/src/stores/systemStore.ts`)

**Purpose**: Global state for system health monitoring

**State Tracked**:

```typescript
{
  isOnline: boolean,                    // Browser navigator.onLine
  isWebServerReachable: boolean | null, // Railway server (desktop/mobile only)
  isElectricConnected: boolean,         // Electric sync connection
  isPostgresAvailable: boolean,         // Postgres via Electric
  overallStatus: "synced" | "syncing" | "offline" | "server-down"
}
```

**Features**:

- Automatic `online`/`offline` event listeners
- Periodic server health checks (30s polling for desktop/mobile)
- Computed `overallStatus` from individual states
- Single `initializeMonitoring()` call starts all monitoring

### 2. Connection Status Indicator (`packages/ui/src/system/ConnectionStatusIndicator.tsx`)

**Platform-agnostic component** displaying 4 states:

| Status        | Icon         | Color  | Meaning                            |
| ------------- | ------------ | ------ | ---------------------------------- |
| `synced`      | ✓ Check      | Green  | All systems operational            |
| `syncing`     | ⟳ Loader     | Yellow | Connected but sync in progress     |
| `offline`     | 📡 WifiOff   | Red    | No internet connection             |
| `server-down` | 🖥️ ServerOff | Red    | Internet OK but server unreachable |

Uses **Lucide icons** as specified.

### 3. Platform Detection (`apps/web/app/components/SystemMonitoringProvider.tsx`)

**Automatic platform detection**:

```typescript
// Detects Tauri (desktop)
"__TAURI__" in window || "__TAURI_INTERNALS__" in window;

// Detects Capacitor (mobile)
"Capacitor" in window;
```

**Behavior**:

- **Web**: `webServerUrl = null` (no server checks needed)
- **Desktop/Mobile**: `webServerUrl = window.location.origin` (monitors Railway)

### 4. Electric Sync Integration (`packages/data/src/electric.ts`)

**Automatic connection tracking**:

- `useShape` hook updates `systemStore.setElectricConnected()` when sync status changes
- Connected when status is `"synced"` or `"syncing"`
- Disconnected when status is `"connecting"` or `"error"`

### 5. Offline-Aware Sign-In

**Two entry points protected**:

1. **Sign-In Page** (`apps/web/app/auth/signin/_components/SignInForm.tsx`)
2. **UserMenu Button** (`apps/web/app/components/UserMenu.tsx`)

**Behavior**:

- Check `useSystemStore(state => state.isOnline)` before navigation
- If offline: show modal "No Internet Connection" instead of navigating
- Prevents Railway 404 errors when desktop app opens offline

## Platform Behavior

### Web App

- **States Shown**: 3 (synced, syncing, offline)
- **Server Check**: None (served from same origin)
- **Logic**: `server-down` → `synced` (never shows server-down)

### Desktop App (Tauri)

- **States Shown**: All 4 states
- **Server Check**: Monitors `window.location.origin`
  - Dev: `http://localhost:3000`
  - Prod: `https://deeprecall-production.up.railway.app`
- **Graceful Degradation**: Shows offline modal instead of Railway 404

### Mobile App (Capacitor)

- **States Shown**: All 4 states (same as desktop)
- **Server Check**: Monitors Capacitor WebView URL
- **No mobile-specific code needed** - auto-detects via `window.Capacitor`

## Usage

### Initialize Monitoring (App Root)

```tsx
// In ClientLayout or root component
import { SystemMonitoringProvider } from "./components/SystemMonitoringProvider";

export function ClientLayout({ children }) {
  return <SystemMonitoringProvider>{children}</SystemMonitoringProvider>;
}
```

### Display Connection Status (Navigation)

```tsx
import { WebConnectionStatus } from "./components/WebConnectionStatus";

<nav>
  <WebConnectionStatus />
  {/* Other nav items */}
</nav>;
```

### Check Connection in Components

```tsx
import { useSystemStore } from "@deeprecall/data/stores";

function MyComponent() {
  const isOnline = useSystemStore((state) => state.isOnline);
  const overallStatus = useSystemStore((state) => state.overallStatus);

  // Use status...
}
```

### Update System States

```typescript
// Update Electric connection (done automatically in useShape)
useSystemStore.getState().setElectricConnected(true);

// Update Postgres availability
useSystemStore.getState().setPostgresAvailable(false);
```

## Future Extensions

The system store is designed to accommodate additional global states:

### Settings Store (Planned)

```typescript
// packages/data/src/stores/settingsStore.ts
{
  theme: "light" | "dark" | "system",
  appearance: { ... },
  preferences: { ... },
  featureFlags: { ... }
}
```

### Benefits of This Architecture

1. **Single source of truth** for system states
2. **No prop drilling** - access state anywhere
3. **Reactive updates** - UI auto-updates when state changes
4. **Persistence ready** - Zustand supports localStorage middleware
5. **DevTools friendly** - Works with Redux DevTools
6. **TypeScript first** - Full type safety

## Testing

### Test Connection States

1. **Online**: Default state
2. **Offline**: Disable network in browser DevTools
3. **Server Down**: Stop Railway deployment
4. **Electric Disconnected**: Stop Electric service

### Test Desktop Offline Handling

1. Open desktop app
2. Disable network
3. Click "Sign In" button
4. Should see modal instead of Railway 404

## Files Created/Modified

### Created

- `packages/data/src/stores/systemStore.ts` - System state store
- `packages/data/src/hooks/useSystemMonitoring.ts` - Initialization hook
- `packages/ui/src/system/ConnectionStatusIndicator.tsx` - UI component
- `apps/web/app/components/SystemMonitoringProvider.tsx` - Monitoring provider
- `apps/web/app/components/WebConnectionStatus.tsx` - Connection indicator

### Modified

- `packages/data/src/stores/index.ts` - Export systemStore
- `packages/data/src/hooks/index.ts` - Export useSystemMonitoring
- `packages/ui/src/index.ts` - Export ConnectionStatusIndicator
- `packages/data/src/electric.ts` - Wire Electric connection to store
- `apps/web/app/ClientLayout.tsx` - Add monitoring provider and indicator
- `apps/web/app/components/UserMenu.tsx` - Offline detection for sign-in
- `apps/web/app/auth/signin/_components/SignInForm.tsx` - Offline modal

## Next Steps

1. **Mobile Testing**: Verify Capacitor auto-detection works
2. **Settings Store**: Create settings/preferences store
3. **Persistence**: Add localStorage middleware for settings
4. **Theme Support**: Implement theme toggle using settings store
5. **Feature Flags**: Add feature flag system to settings store
