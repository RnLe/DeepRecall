/**
 * Mobile App Providers
 * Sets up QueryClient, Electric sync, and WriteBuffer flush worker
 *
 * Key differences from desktop:
 * - Uses HTTP API for write flushing (no direct Postgres connection)
 * - Same Electric Cloud credentials as desktop
 * - Same SyncManager pattern (one writer per synced table)
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "./config/api";
import {
  initElectric,
  initFlushWorker,
  setAuthState,
  getDeviceId,
  usePresetsSync,
  useActivitiesSync,
  useAnnotationsSync,
  useAssetsSync,
  useAuthorsSync,
  useBlobsMetaSync,
  useCardsSync,
  useCollectionsSync,
  useDeviceBlobsSync,
  useEdgesSync,
  useReplicationJobsSync,
  useReviewLogsSync,
  useWorksSync,
  useBoardsSync,
  useStrokesSync,
  initializeDeviceId,
} from "@deeprecall/data";
import { configurePdfWorker } from "@deeprecall/pdf";
import { logger } from "@deeprecall/telemetry";
import { CapacitorBlobStorage } from "./blob-storage/capacitor";
import { resolveElectricUrl } from "./utils/electricConfig";

// Extend Window interface for Capacitor
declare global {
  interface Window {
    Capacitor?: {
      getPlatform: () => string;
      isNativePlatform: () => boolean;
    };
  }
}

// Configure PDF.js worker for Capacitor platform
// Capacitor serves static assets from public/ directory
configurePdfWorker("/pdf.worker.min.mjs");

// Initialize device ID from Capacitor Preferences storage
// This ensures a stable device UUID across app restarts
initializeDeviceId().catch((err) =>
  logger.error("sync.coordination", "Failed to initialize device ID", {
    error: err,
  })
);

/**
 * AuthStateManager: Syncs mobile session with global auth state
 * Handles guest→user upgrade after sign-in
 * Handles sign-out cleanup
 */
function AuthStateManager({ children }: { children: React.ReactNode }) {
  const hasUpgradedRef = useRef(false);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const deviceId = getDeviceId();

    // Check session periodically to detect sign-in/sign-out
    async function checkSession() {
      try {
        const { loadSession } = await import("./auth/session");
        const sessionInfo = await loadSession();

        const currentUserId = sessionInfo?.userId || null;
        const prevUserId = prevUserIdRef.current;

        // Detect sign-out (user was authenticated, now isn't)
        if (prevUserId && !currentUserId) {
          logger.info("auth", "Sign-out detected, resetting auth state");
          setAuthState(false, null, deviceId);
          hasUpgradedRef.current = false;
          prevUserIdRef.current = null;
          return;
        }

        // Detect sign-in (user wasn't authenticated, now is)
        if (!prevUserId && currentUserId) {
          const authToken = sessionInfo?.appJWT;

          logger.info("auth", "Sign-in detected, running auth flow", {
            userId: currentUserId.slice(0, 8),
          });

          // Perform guest→user upgrade once per session using centralized flow
          if (!hasUpgradedRef.current) {
            hasUpgradedRef.current = true;

            const { handleSignIn, debugAccountStatus } = await import(
              "@deeprecall/data"
            );
            const apiBaseUrl = getApiBaseUrl();
            const cas = new CapacitorBlobStorage();

            // Debug: Log detailed account status
            await debugAccountStatus(currentUserId, apiBaseUrl, authToken);

            try {
              const result = await handleSignIn(
                currentUserId,
                deviceId,
                cas,
                apiBaseUrl,
                authToken
              );
              if (result.success) {
                logger.info("auth", `Sign-in complete: ${result.action}`, {
                  userId: currentUserId.slice(0, 8),
                  ...result.details,
                });
              } else {
                logger.error("auth", "Sign-in flow failed", {
                  userId: currentUserId.slice(0, 8),
                  error: result.error,
                });
              }
            } catch (error) {
              logger.error("auth", "Sign-in flow exception", {
                error: error instanceof Error ? error.message : String(error),
                userId: currentUserId.slice(0, 8),
              });
            }

            // Note: setAuthState is called INSIDE handleSignIn
          }

          prevUserIdRef.current = currentUserId;
        }

        // No change in auth state
        if (prevUserId === currentUserId) {
          return;
        }
      } catch (error) {
        logger.error("auth", "Failed to check session", { error });
      }
    }

    // Initial check on mount
    checkSession();

    // Check every 2 seconds for session changes
    // This is lightweight since we just check secure storage
    const interval = setInterval(checkSession, 2000);

    return () => clearInterval(interval);
  }, []);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60_000, // 5 minutes
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Expose QueryClient globally for auth flows
  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__queryClient = queryClient;
    }
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthStateManager>
        <GuestModeInitializer />
        <ElectricInitializer />
        <ConditionalSyncManager />
        {children}
      </AuthStateManager>
    </QueryClientProvider>
  );
}

/**
 * Initialize guest mode when user is not authenticated
 * Handles presets initialization and CAS scan
 */
function GuestModeInitializer() {
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    async function checkAndInitialize() {
      // Check if user is authenticated
      const { loadSession } = await import("./auth/session");
      const sessionInfo = await loadSession();

      const isGuest = !sessionInfo || !sessionInfo.userId;

      if (isGuest && !hasInitializedRef.current) {
        hasInitializedRef.current = true;

        const { getDeviceId } = await import("@deeprecall/data");
        const deviceId = getDeviceId();

        // Check if blob tables are empty (need initialization)
        const { db } = await import("@deeprecall/data/db");
        const [blobsMetaCount, deviceBlobsCount] = await Promise.all([
          db.blobsMeta.count(),
          db.deviceBlobs.count(),
        ]);

        if (blobsMetaCount === 0 && deviceBlobsCount === 0) {
          logger.info(
            "auth",
            "Mobile guest mode: Initializing (presets + CAS scan)"
          );

          const { initializeGuestMode } = await import("@deeprecall/data");
          const { CapacitorBlobStorage } = await import(
            "./blob-storage/capacitor"
          );
          const cas = new CapacitorBlobStorage();

          try {
            const result = await initializeGuestMode(cas, deviceId);
            logger.info("auth", "✅ Mobile guest mode initialized", {
              presetsInitialized: result.presetsInitialized,
              blobsScanned: result.blobsScanned,
              blobsCoordinated: result.blobsCoordinated,
            });
          } catch (error) {
            logger.error("auth", "Failed to initialize mobile guest mode", {
              error,
            });
          }
        } else {
          logger.debug("auth", "Mobile guest mode: Data already initialized", {
            blobsMetaCount,
            deviceBlobsCount,
          });
        }
      }
    }

    checkAndInitialize();
  }, []);

  return null;
}

/**
 * Initialize Electric sync and WriteBuffer flush worker
 *
 * Mobile app configuration:
 * - Electric sync: Direct to Electric Cloud (same as desktop)
 * - Write buffer: Via Next.js API (localhost:3000 in dev, production URL in prod)
 *
 * Architecture:
 * - Desktop: Electric Cloud + Tauri commands → Direct Postgres
 * - Web: Electric Cloud + Next.js API → Neon Postgres
 * - Mobile: Electric Cloud + Next.js API → Neon Postgres (same as web)
 */
function ElectricInitializer() {
  const workerRef = useRef<ReturnType<typeof initFlushWorker> | null>(null);

  useEffect(() => {
    // Initialize Electric connection with Cloud credentials
    const electricUrl = resolveElectricUrl();
    const electricSourceId = import.meta.env.VITE_ELECTRIC_SOURCE_ID;
    const electricSecret = import.meta.env.VITE_ELECTRIC_SOURCE_SECRET;

    initElectric({
      url: electricUrl,
      sourceId: electricSourceId,
      secret: electricSecret,
    });
    logger.info("sync.electric", "Mobile app connected", { electricUrl });
    if (electricSourceId && electricSecret) {
      logger.debug("sync.electric", "Using Electric Cloud authentication");
    } else {
      logger.debug("sync.electric", "Using local Electric instance (no auth)");
    }

    // Initialize FlushWorker for mobile
    // Mobile uses HTTP API (same as web app)
    const apiBaseUrl = getApiBaseUrl();
    logger.info("sync.writeBuffer", "API configuration", {
      baseUrl: apiBaseUrl,
      endpoint: `${apiBaseUrl}/api/writes/batch`,
      viteApiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    });

    const worker = initFlushWorker({
      flushHandler: async (changes) => {
        const endpoint = `${apiBaseUrl}/api/writes/batch`;
        logger.debug("sync.writeBuffer", "Attempting flush", {
          endpoint,
          count: changes.length,
        });
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ changes }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            logger.error("sync.writeBuffer", "HTTP error", {
              status: response.status,
              statusText: response.statusText,
              errorText,
            });
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();
          return {
            applied: result.applied || [],
            errors: result.errors || [],
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : JSON.stringify(error);
          logger.error("sync.writeBuffer", "HTTP API failed", {
            error: message,
            stack:
              error instanceof Error && "stack" in error
                ? error.stack
                : undefined,
          });
          // Return all changes as failed
          return {
            applied: [],
            errors: changes.map((c) => ({
              id: c.id,
              error: String(error),
            })),
          };
        }
      },
      batchSize: 10,
      retryDelay: 1000,
      maxRetryDelay: 30000,
      maxRetries: 5,
    });
    worker.start(5000); // Check every 5 seconds (mobile optimized)
    workerRef.current = worker;
    logger.info("sync.writeBuffer", "FlushWorker started", {
      intervalMs: 5000,
      endpoint: `${apiBaseUrl}/api/writes/batch`,
    });

    // Expose for debugging
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__deeprecall_flush_worker = worker;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__deeprecall_buffer = worker.getBuffer();
      logger.debug("ui", "Mobile debug tools exposed", {
        tools: [
          "window.__deeprecall_flush_worker",
          "window.__deeprecall_buffer.getStats()",
        ],
      });
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.stop();
        logger.info("sync.writeBuffer", "FlushWorker stopped");
      }
    };
  }, []);

  return null;
}

/**
 * Wrapper that conditionally renders SyncManager based on auth
 * Blob syncs (useBlobsMetaSync, useDeviceBlobsSync) run for both guest and authenticated
 * Other syncs only run when authenticated
 */
function ConditionalSyncManager() {
  // CRITICAL: Use global auth state userId, NOT session info
  // The session loads immediately on app startup, but handleSignIn() must complete
  // BEFORE we start syncing (to allow wipeGuestData() to finish first).
  // The global userId is only set AFTER handleSignIn() completes.
  const [authUserId, setAuthUserId] = useState<string | undefined>(undefined);

  // Subscribe to global auth state changes
  useEffect(() => {
    import("@deeprecall/data").then(({ getUserId, subscribeToAuthState }) => {
      // Set initial value
      const userId = getUserId();
      setAuthUserId(userId || undefined);

      // Subscribe to changes
      const unsubscribe = subscribeToAuthState(() => {
        const newUserId = getUserId();
        setAuthUserId(newUserId || undefined);
      });

      return unsubscribe;
    });
  }, []); // Only run once on mount

  const isGuest = !authUserId;

  // SECURITY: Always sync blob metadata (needed for CAS coordination)
  // When userId is undefined, guests can see their local blobs only
  // When userId is present, RLS filters to user's blobs
  useBlobsMetaSync(authUserId);
  useDeviceBlobsSync(authUserId);

  // Only sync other data when authenticated
  if (isGuest) {
    return null;
  }

  return <SyncManager userId={authUserId} />;
}

/**
 * SyncManager: Centralized Electric → Dexie sync coordinator
 *
 * CRITICAL: Runs ALL sync hooks exactly ONCE to prevent race conditions.
 * - Subscribes to Electric shapes
 * - Syncs data to Dexie synced tables
 * - Runs cleanup on local tables
 *
 * Same implementation as desktop/web - platform agnostic!
 *
 * NOTE: Blob syncs (useBlobsMetaSync, useDeviceBlobsSync) are in ConditionalSyncManager
 * so they run even for guests (needed for local CAS functionality).
 */
function SyncManager({ userId }: { userId?: string }) {
  // Sync hooks (alphabetical order) - user data only
  // Pass userId for multi-tenant isolation (filters by owner_id)
  useActivitiesSync(userId);
  useAnnotationsSync(userId);
  useAssetsSync(userId);
  useAuthorsSync(userId);
  useBoardsSync(userId);
  useCardsSync(userId);
  useCollectionsSync(userId);
  useEdgesSync(userId);
  usePresetsSync(userId);
  useReplicationJobsSync(userId);
  useReviewLogsSync(userId);
  useStrokesSync(userId);
  useWorksSync(userId);

  return null;
}
