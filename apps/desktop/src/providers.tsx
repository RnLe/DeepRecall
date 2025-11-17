import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  initElectric,
  initFlushWorker,
  initializeDeviceId,
  setAuthState,
  getDeviceId,
  handleSignIn,
  debugAccountStatus,
  useSystemMonitoring,
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
} from "@deeprecall/data";
import { configurePdfWorker } from "@deeprecall/pdf";
import { DevToolsShortcut } from "./components/DevToolsShortcut";
import { logger } from "@deeprecall/telemetry";
import { TauriBlobStorage } from "./blob-storage/tauri";

// Configure PDF.js worker for Tauri platform
// Tauri serves static assets from public/ directory
configurePdfWorker("/pdf.worker.min.mjs");

// Initialize device ID on app startup (Tauri Store persistence)
initializeDeviceId().catch((error) => {
  logger.error("sync.coordination", "Failed to initialize device ID", {
    error,
  });
});

/**
 * AuthStateManager: Syncs Tauri session with global auth state
 * Handles guest→user upgrade after sign-in
 */
function AuthStateManager({ children }: { children: React.ReactNode }) {
  const hasUpgradedRef = useRef(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const deviceId = getDeviceId();

    // Initialize session on mount
    async function initSession() {
      try {
        const { initializeSession } = await import("./auth");
        const sessionInfo = await initializeSession();
        setSession(sessionInfo);

        if (sessionInfo.status === "authenticated" && sessionInfo.userId) {
          const userId = sessionInfo.userId;
          const authToken = sessionInfo.appJWT;

          logger.info(
            "auth",
            "Desktop user authenticated, updating auth state",
            {
              userId,
              deviceId,
            }
          );

          if (!hasUpgradedRef.current) {
            hasUpgradedRef.current = true;

            (async () => {
              const apiBaseUrl =
                import.meta.env.VITE_API_URL || "http://localhost:3000";
              const cas = new TauriBlobStorage();

              try {
                await debugAccountStatus(userId, apiBaseUrl, authToken);
              } catch (error) {
                logger.warn("auth", "Failed to get account debug info", {
                  error: error instanceof Error ? error.message : String(error),
                });
              }

              try {
                const result = await handleSignIn(
                  userId,
                  deviceId,
                  cas,
                  apiBaseUrl,
                  authToken
                );

                if (result.success) {
                  logger.info("auth", `Sign-in complete: ${result.action}`, {
                    userId: userId.slice(0, 8),
                    ...result.details,
                  });
                } else {
                  logger.error("auth", "Sign-in flow failed", {
                    userId: userId.slice(0, 8),
                    error: result.error,
                  });
                }
              } catch (error) {
                logger.error("auth", "Sign-in flow exception", {
                  error: error instanceof Error ? error.message : String(error),
                  userId: userId.slice(0, 8),
                });
                // Fallback to authenticated state so user can continue offline
                setAuthState(true, userId, deviceId);
              }
            })();
          } else {
            setAuthState(true, userId, deviceId);
          }
        } else {
          // Guest mode
          logger.info("auth", "Desktop user not authenticated, guest mode", {
            deviceId,
          });
          setAuthState(false, null, deviceId);
          hasUpgradedRef.current = false;

          // Note: Guest mode initialization (presets + CAS scan) is handled
          // by a separate component to ensure proper coordination
        }
      } catch (error) {
        logger.error("auth", "Failed to initialize session", { error });
        // Default to guest mode on error
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
      <DevToolsShortcut />
      <AuthStateManager>
        <GuestModeInitializer />
        <SystemMonitoringProvider />
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
      const { initializeSession } = await import("./auth");
      const sessionInfo = await initializeSession();

      const isGuest = sessionInfo.status !== "authenticated";

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
            "Desktop guest mode: Initializing (presets + CAS scan)"
          );

          const { initializeGuestMode } = await import("@deeprecall/data");
          const { TauriBlobStorage } = await import("./blob-storage/tauri");
          const cas = new TauriBlobStorage();

          try {
            const result = await initializeGuestMode(cas, deviceId);
            logger.info("auth", "✅ Desktop guest mode initialized", {
              presetsInitialized: result.presetsInitialized,
              blobsScanned: result.blobsScanned,
              blobsCoordinated: result.blobsCoordinated,
            });
          } catch (error) {
            logger.error("auth", "Failed to initialize desktop guest mode", {
              error,
            });
          }
        } else {
          logger.debug("auth", "Desktop guest mode: Data already initialized", {
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
 * Initialize system monitoring for desktop app
 * Monitors web server reachability (Railway in prod, localhost in dev)
 */
function SystemMonitoringProvider() {
  // Desktop monitors the web server URL for OAuth and other web features
  const webServerUrl =
    import.meta.env.MODE === "production"
      ? "https://deeprecall-production.up.railway.app"
      : "http://localhost:3000";

  useSystemMonitoring({ webServerUrl });

  return null;
}

/**
 * Initialize Electric sync and WriteBuffer flush worker
 * Connects to shared Docker Electric instance (same as web app)
 *
 * In production: Uses authenticated Electric tokens from Auth Broker
 * In development: Falls back to sourceId/secret for unauthenticated sync
 */
function ElectricInitializer() {
  const workerRef = useRef<ReturnType<typeof initFlushWorker> | null>(null);
  const [electricToken, setElectricToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Get Electric token if authenticated
  useEffect(() => {
    async function loadElectricToken() {
      try {
        // Check if user is authenticated
        const { initializeSession, getElectricToken } = await import("./auth");
        const session = await initializeSession();

        if (session.status === "authenticated") {
          logger.info(
            "sync.electric",
            "User authenticated, getting Electric token"
          );
          const token = await getElectricToken();
          if (token) {
            setElectricToken(token);
            logger.info("sync.electric", "Got Electric replication token");
          } else {
            logger.warn(
              "sync.electric",
              "Failed to get Electric token, using unauthenticated sync"
            );
          }
        } else {
          logger.info(
            "sync.electric",
            "User not authenticated, using unauthenticated sync"
          );
        }
      } catch (error) {
        logger.error("sync.electric", "Failed to load Electric token", {
          error,
        });
      }
    }

    loadElectricToken();
  }, []);

  useEffect(() => {
    if (isInitialized) return; // Only initialize once

    // Initialize Electric connection
    const electricUrl =
      import.meta.env.VITE_ELECTRIC_URL || "http://localhost:5133";
    const electricSourceId = import.meta.env.VITE_ELECTRIC_SOURCE_ID;
    const electricSecret = import.meta.env.VITE_ELECTRIC_SOURCE_SECRET;

    // Use Electric token if available (authenticated), otherwise fall back to sourceId/secret
    if (electricToken) {
      initElectric({
        url: electricUrl,
        token: electricToken, // Authenticated token with userId for RLS
      });
      logger.info("sync.electric", "Desktop app connected (authenticated)", {
        electricUrl,
        hasToken: true,
      });
    } else {
      initElectric({
        url: electricUrl,
        sourceId: electricSourceId, // Electric Cloud source ID
        secret: electricSecret, // Electric Cloud source secret
      });
      logger.info("sync.electric", "Desktop app connected (unauthenticated)", {
        electricUrl,
        hasSourceId: !!electricSourceId,
      });
      if (electricSourceId && electricSecret) {
        logger.debug("sync.electric", "Using Electric Cloud authentication");
      }
    }

    setIsInitialized(true);

    // Initialize FlushWorker for desktop
    // Desktop uses Tauri commands for direct Postgres writes
    const worker = initFlushWorker({
      flushHandler: async (changes) => {
        try {
          // Get current user ID from session
          const { initializeSession } = await import("./auth");
          const session = await initializeSession();

          const userId =
            session.status === "authenticated" ? session.userId : null;

          if (!userId) {
            logger.warn(
              "sync.writeBuffer",
              "No authenticated user - writes may fail due to RLS"
            );
          }

          const results = await invoke<
            Array<{ id: string; success: boolean; error?: string }>
          >("flush_writes", { changes, userId });

          // Transform Rust results to FlushWorker format
          const applied: string[] = [];
          const errors: Array<{ id: string; error: string }> = [];

          for (const result of results) {
            if (result.success) {
              applied.push(result.id);
            } else {
              errors.push({
                id: result.id,
                error: result.error || "Unknown error",
              });
            }
          }

          return { applied, errors };
        } catch (error) {
          logger.error(
            "sync.writeBuffer",
            "Tauri flush_writes command failed",
            { error }
          );
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
    worker.start(1000); // Check every 1 second
    workerRef.current = worker;
    logger.info("sync.writeBuffer", "FlushWorker started", {
      intervalMs: 1000,
    });
    logger.debug(
      "sync.writeBuffer",
      "Using Tauri flush_writes command for direct Postgres writes"
    );

    // Expose for debugging
    if (typeof window !== "undefined") {
      (window as any).__deeprecall_flush_worker = worker;
      (window as any).__deeprecall_buffer = worker.getBuffer();
      logger.debug("ui", "Desktop debug tools exposed", {
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
 * Same implementation as web app - platform agnostic!
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
