# Zustand Global Stores

> **Quick reference for global state management using Zustand**

---

## Why Zustand?

DeepRecall uses **Zustand** for client-side global state (system status, user preferences) alongside **Electric** for server-synced data.

**Rationale:**

- Lightweight (~1KB)
- No provider overhead (works across monorepo packages)
- Event-driven states (connection status, sync health)
- Future-ready (settings, theme, feature flags)

---

## System Store

**File**: `packages/data/src/stores/systemStore.ts`

**Purpose**: Monitor system health and connection status

### State Tracked

```typescript
{
  isOnline: boolean,                    // Browser navigator.onLine
  isWebServerReachable: boolean | null, // Railway server (desktop/mobile only)
  isElectricConnected: boolean,         // Electric sync connection
  isPostgresAvailable: boolean,         // Postgres via Electric
  overallStatus: "synced" | "syncing" | "offline" | "server-down"
}
```

### Key Methods

```typescript
// Initialize monitoring (call once at app startup)
initializeMonitoring(webServerUrl?: string): void

// Update individual states
setOnline(online: boolean): void
setElectricConnected(connected: boolean): void
setPostgresAvailable(available: boolean): void
```

### Platform Behavior

**Web**: `webServerUrl = null` (no server checks needed)  
**Desktop/Mobile**: `webServerUrl = window.location.origin` (monitors Railway)

**Status Logic**:

- `synced`: All systems operational
- `syncing`: Connected but sync in progress
- `offline`: No internet connection
- `server-down`: Internet OK but server unreachable (desktop/mobile only)

---

## Usage Patterns

### Initialize Monitoring

```tsx
// In app root (ClientLayout or providers)
import { useSystemStore } from "@deeprecall/data/stores";

useEffect(() => {
  const webServerUrl =
    detectPlatform() === "web" ? null : window.location.origin;
  useSystemStore.getState().initializeMonitoring(webServerUrl);
}, []);
```

### Read State in Components

```tsx
import { useSystemStore } from "@deeprecall/data/stores";

function MyComponent() {
  const isOnline = useSystemStore((state) => state.isOnline);
  const overallStatus = useSystemStore((state) => state.overallStatus);

  // Use status...
}
```

### Update State (Internal)

```typescript
// Electric integration (automatic)
useSystemStore.getState().setElectricConnected(status === "synced");

// Custom updates
useSystemStore.getState().setPostgresAvailable(false);
```

---

## Integration Points

### 1. Electric Client (`packages/data/src/electric.ts`)

Auto-updates `isElectricConnected` when sync status changes:

```typescript
useEffect(() => {
  const connected = status === "synced" || status === "syncing";
  useSystemStore.getState().setElectricConnected(connected);
}, [status]);
```

### 2. Offline-Aware Sign-In

Checks `isOnline` before navigation to prevent Railway 404 errors:

```tsx
const isOnline = useSystemStore((state) => state.isOnline);

const handleSignIn = () => {
  if (!isOnline) {
    showOfflineModal();
    return;
  }
  router.push("/auth/signin");
};
```

### 3. Connection Status Indicator

UI component displaying system health:

```tsx
import { ConnectionStatusIndicator } from "@deeprecall/ui/system";

<nav>
  <ConnectionStatusIndicator />
</nav>;
```

---

## Future Stores (Planned)

### Settings Store

```typescript
// packages/data/src/stores/settingsStore.ts
{
  theme: "light" | "dark" | "system",
  appearance: { ... },
  preferences: { ... },
  featureFlags: { ... }
}
```

**Use case**: User preferences, theme toggle, feature flags

### Benefits

- **Persistence ready** - Zustand supports localStorage middleware
- **DevTools friendly** - Works with Redux DevTools
- **Type-safe** - Full TypeScript support

---

## Architecture Notes

**Separation of Concerns**:

- **Electric** = Server-synced data (works, assets, annotations)
- **Zustand** = Client-side state (system status, preferences)
- **React Query** = Server state caching (API routes, one-off fetches)

**Why not React Query for system status?**

- Connection status is event-driven (navigator.onLine, Electric events), not HTTP-based
- No polling needed - Zustand listens to events and updates reactively
- Simpler for non-HTTP states (theme, feature flags, UI state)

---

## See Also

- Source: `packages/data/src/stores/systemStore.ts`
- UI: `packages/ui/src/system/ConnectionStatusIndicator.tsx`
- Provider: `apps/web/app/components/SystemMonitoringProvider.tsx`
