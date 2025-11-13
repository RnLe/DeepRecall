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
  upgradeGuestToUser,
  hasGuestData,
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
 */
function AuthStateManager({ children }: { children: React.ReactNode }) {
  const hasUpgradedRef = useRef(false);

  useEffect(() => {
    const deviceId = getDeviceId();

    // Initialize session on mount
    async function initSession() {
      try {
        const { loadSession } = await import("./auth/session");
        const sessionInfo = await loadSession();

        if (sessionInfo && sessionInfo.userId) {
          // User authenticated
          const userId = sessionInfo.userId;

          logger.info(
            "auth",
            "Mobile user authenticated, updating auth state",
            {
              userId,
              deviceId,
            }
          );

          // Perform guest→user upgrade once per session
          // IMPORTANT: This must complete BEFORE setAuthState to prevent race conditions
          // with Electric sync (which triggers when userId is set)
          if (!hasUpgradedRef.current) {
            hasUpgradedRef.current = true;

            const hasData = await hasGuestData(deviceId);
            if (hasData) {
              logger.info(
                "auth",
                "Guest data detected, checking account status",
                {
                  userId: userId.slice(0, 8),
                }
              );

              try {
                const { isNewAccount, wipeGuestData } = await import(
                  "@deeprecall/data"
                );
                const apiBaseUrl = getApiBaseUrl();

                const accountIsNew = await isNewAccount(userId, apiBaseUrl);

                logger.info("auth", "Account status determined", {
                  userId: userId.slice(0, 8),
                  isNew: accountIsNew,
                  hasGuestData: true,
                });

                if (accountIsNew) {
                  // NEW account: Upgrade guest data
                  logger.info(
                    "auth",
                    "NEW account detected - upgrading guest data",
                    {
                      userId: userId.slice(0, 8),
                    }
                  );

                  const cas = new CapacitorBlobStorage();
                  const result = await upgradeGuestToUser(
                    userId,
                    deviceId,
                    cas,
                    apiBaseUrl
                  );

                  logger.info("auth", "✅ Guest data UPGRADED successfully", {
                    userId: userId.slice(0, 8),
                    synced: result.synced,
                  });
                } else {
                  // EXISTING account: Wipe guest data
                  logger.info(
                    "auth",
                    "EXISTING account detected - wiping guest data",
                    {
                      userId: userId.slice(0, 8),
                    }
                  );

                  await wipeGuestData();

                  logger.info("auth", "✅ Guest data WIPED successfully", {
                    userId: userId.slice(0, 8),
                  });
                }
              } catch (error) {
                logger.error("auth", "❌ Guest data handling failed", {
                  error: error instanceof Error ? error.message : String(error),
                  userId: userId.slice(0, 8),
                });
              }
            } else {
              logger.info("auth", "No guest data found - starting fresh", {
                userId: userId.slice(0, 8),
              });
            }

            // Set auth state AFTER guest data handling completes
            // This ensures wipeGuestData() finishes before Electric starts syncing
            setAuthState(true, userId, deviceId);
          } else {
            // Already upgraded, just set auth state
            setAuthState(true, userId, deviceId);
          }
        } else {
          // Guest mode (no session)
          logger.info("auth", "Mobile user not authenticated, guest mode", {
            deviceId,
          });
          setAuthState(false, null, deviceId);
          hasUpgradedRef.current = false;

          // Note: Guest mode initialization (presets + CAS scan) is handled
          // by a separate component to ensure proper coordination
        }
      } catch (error) {
        logger.error("auth", "Failed to load session", { error });
        // Default to guest mode on error
        const deviceId = getDeviceId();
        setAuthState(false, null, deviceId);
      }
    }

    initSession();
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

  return (
    <QueryClientProvider client={queryClient}>
      <AuthStateManager>
        <GuestModeInitializer />
        <ElectricInitializer />
        <SyncManager />
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
    const electricUrl =
      import.meta.env.VITE_ELECTRIC_URL || "http://localhost:5133";
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
 * SyncManager: Centralized Electric → Dexie sync coordinator
 *
 * CRITICAL: Runs ALL sync hooks exactly ONCE to prevent race conditions.
 * - Subscribes to Electric shapes
 * - Syncs data to Dexie synced tables
 * - Runs cleanup on local tables
 *
 * Same implementation as desktop/web - platform agnostic!
 */
function SyncManager() {
  // Sync hooks (alphabetical order)
  useActivitiesSync();
  useAnnotationsSync();
  useAssetsSync();
  useAuthorsSync();
  useBlobsMetaSync();
  useBoardsSync();
  useCardsSync();
  useCollectionsSync();
  useDeviceBlobsSync();
  useEdgesSync();
  usePresetsSync();
  useReplicationJobsSync();
  useReviewLogsSync();
  useStrokesSync();
  useWorksSync();

  return null;
}
