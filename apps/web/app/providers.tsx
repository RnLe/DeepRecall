"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider, useSession } from "@/src/auth/client";
import { useEffect, useRef, useState } from "react";
import {
  initElectric,
  initFlushWorker,
  initializeDeviceId,
  initConsoleLogger,
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
} from "@deeprecall/data";
import { configurePdfWorker } from "@deeprecall/pdf";
import { initTelemetry } from "@/src/telemetry";
import { logger } from "@deeprecall/telemetry";
import { getWebBlobStorage } from "@/src/blob-storage/web";

// Configure PDF.js worker for Web platform
if (typeof window !== "undefined") {
  // Initialize telemetry first (structured logging)
  initTelemetry();
  logger.info("ui", "Telemetry initialized", {
    env: process.env.NODE_ENV,
    platform: "web",
  });

  configurePdfWorker("/pdf.worker.min.mjs");
  logger.info("pdf", "PDF.js worker configured", {
    workerPath: "/pdf.worker.min.mjs",
  });

  // Initialize console logger for debugging (temporary)
  initConsoleLogger();
  logger.info("ui", "Console logger initialized");

  // Initialize device ID on app startup (reliable persistence)
  initializeDeviceId()
    .then((deviceId) => {
      logger.info("ui", "Device ID initialized", { deviceId });
    })
    .catch((error) => {
      logger.error("ui", "Failed to initialize device ID", { error });
    });
}

/**
 * AuthStateManager: Syncs NextAuth session with global auth state
 * Handles guest→user upgrade after sign-in
 * Handles data cleanup on sign-out
 */
function AuthStateManager({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const hasUpgradedRef = useRef(false);
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    const deviceId = getDeviceId();

    if (status === "loading") {
      // Still loading, don't update auth state yet
      return;
    }

    if (status === "authenticated" && session?.user) {
      // User signed in - handle auth state and upgrade/wipe flow
      const userId = session.user.id || session.user.email || "unknown";

      logger.info("auth", "User authenticated, updating auth state", {
        userId,
        deviceId,
      });

      // Perform guest→user upgrade once per session using centralized flow
      // IMPORTANT: This must complete BEFORE setAuthState to prevent race conditions
      // with Electric sync (which triggers when userId is set)
      if (!hasUpgradedRef.current) {
        hasUpgradedRef.current = true;

        (async () => {
          const { handleSignIn, debugAccountStatus } = await import(
            "@deeprecall/data"
          );
          const apiBaseUrl =
            process.env.NEXT_PUBLIC_API_BASE || window.location.origin;
          const cas = getWebBlobStorage();

          // Debug: Log detailed account status
          await debugAccountStatus(userId, apiBaseUrl);

          try {
            const result = await handleSignIn(
              userId,
              deviceId,
              cas,
              apiBaseUrl
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
          }

          // Note: setAuthState is now called INSIDE handleSignIn (after wipe, before CAS rescan)
          // This ensures isAuthenticated() returns true during CAS coordination
        })();
      }
      // Note: Don't call setAuthState here - handleSignIn calls it internally
      // at the right time (after wipe, before CAS rescan) to ensure proper coordination.
    } else {
      // User signed out or no session - guest mode
      logger.info("auth", "User not authenticated, guest mode", { deviceId });

      setAuthState(false, null, deviceId);

      // Reset upgrade flag
      hasUpgradedRef.current = false;
    }

    // Track previous status for sign-out detection
    prevStatusRef.current = status;
  }, [session, status]);

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
  const [electricReady, setElectricReady] = useState(false);

  // Expose QueryClient globally for auth flows
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__queryClient = queryClient;
    }
  }, [queryClient]);

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <AuthStateManager>
          <ElectricInitializer onReady={() => setElectricReady(true)} />
          {electricReady ? (
            <>
              <ConditionalSyncManager />
              {children}
            </>
          ) : (
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <p>Initializing Electric sync...</p>
            </div>
          )}
        </AuthStateManager>
      </QueryClientProvider>
    </SessionProvider>
  );
}

/**
 * Wrapper that conditionally renders SyncManager based on auth
 * Also handles guest mode initialization (presets + CAS scan)
 */
function ConditionalSyncManager() {
  const { data: session, status } = useSession();
  const isGuest = status !== "loading" && !session;

  // CRITICAL: Use global auth state userId, NOT session.user.id
  // The session loads immediately on page refresh, but handleSignIn() must complete
  // BEFORE we start syncing (to allow wipeGuestData() to finish first).
  // The global userId is only set AFTER handleSignIn() completes.
  const [authUserId, setAuthUserId] = useState<string | undefined>(undefined);
  const hasInitializedGuestRef = useRef(false);
  const previousIsGuestRef = useRef<boolean | null>(null);

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

  // Initialize guest mode when transitioning to guest state
  useEffect(() => {
    // Skip if still loading
    if (status === "loading") return;

    // Check if we transitioned to guest mode (or first time in guest mode)
    const wasNotGuest = previousIsGuestRef.current === false;
    const isFirstCheck = previousIsGuestRef.current === null;
    const shouldInitialize =
      isGuest &&
      !hasInitializedGuestRef.current &&
      (wasNotGuest || isFirstCheck);

    previousIsGuestRef.current = isGuest;

    if (!shouldInitialize) return;

    hasInitializedGuestRef.current = true;
    const deviceId = getDeviceId();

    // Check if blob tables are empty (need initialization)
    import("@deeprecall/data/db").then(({ db }) => {
      Promise.all([db.blobsMeta.count(), db.deviceBlobs.count()])
        .then(([blobsMetaCount, deviceBlobsCount]) => {
          if (blobsMetaCount === 0 && deviceBlobsCount === 0) {
            logger.info(
              "auth",
              "Guest mode: Initializing (presets + CAS scan)"
            );

            // Use centralized initializeGuestMode for sequential execution
            import("@deeprecall/data").then(({ initializeGuestMode }) => {
              import("@/src/blob-storage/web").then(({ getWebBlobStorage }) => {
                const cas = getWebBlobStorage();

                initializeGuestMode(cas, deviceId)
                  .then((result) => {
                    logger.info("auth", "✅ Guest mode initialized", {
                      presetsInitialized: result.presetsInitialized,
                      blobsScanned: result.blobsScanned,
                      blobsCoordinated: result.blobsCoordinated,
                    });
                  })
                  .catch((error) => {
                    logger.error("auth", "Failed to initialize guest mode", {
                      error,
                    });
                  });
              });
            });
          } else {
            logger.debug(
              "auth",
              "Guest mode: Blob tables have data, skipping initialization",
              {
                blobsMetaCount,
                deviceBlobsCount,
              }
            );
          }
        })
        .catch((error) => {
          logger.error("auth", "Failed to check blob tables", { error });
        });
    });
  }, [isGuest, status]);

  // SECURITY: Only pass userId when authenticated to enable multi-tenant filtering
  // When userId is undefined, the hooks will skip Electric sync (guest mode)
  // This prevents guests from seeing other users' blob metadata
  useBlobsMetaSync(authUserId);
  useDeviceBlobsSync(authUserId);

  // Note: We DO NOT run automatic integrity checks here.
  // Integrity checks should only be run manually by the user or on specific triggers
  // (like after a CAS scan). Running them automatically causes race conditions:
  // 1. Electric syncs device_blobs from server
  // 2. Integrity check modifies them in Dexie (localPath=null)
  // 3. Sync hook sees mismatch and DELETES the blobs (catastrophic!)

  // Only sync other data when authenticated
  if (isGuest) {
    return null;
  }

  return <SyncManager userId={authUserId} />;
}

/**
 * Initialize Electric sync and WriteBuffer flush worker
 * Only runs when user is authenticated (not guest)
 */
function ElectricInitializer({ onReady }: { onReady: () => void }) {
  const { data: session, status } = useSession();
  const isGuest = status !== "loading" && !session;
  const isAuthenticated = status === "authenticated" && !!session;
  const workerRef = useRef<ReturnType<typeof initFlushWorker> | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    // Wait for auth status to be determined
    if (status === "loading") {
      return;
    }

    // Initialize Electric for both guest and authenticated users
    // Guests need Electric initialized (even if they don't sync) to prevent crashes
    async function initializeWithRuntimeConfig() {
      try {
        logger.info(
          "sync.electric",
          "Fetching runtime config from /api/config"
        );
        const response = await fetch("/api/config");
        const config = await response.json();

        logger.info("sync.electric", "Runtime config received", {
          electricUrl: config.electricUrl,
          hasSourceId: !!config.electricSourceId,
          hasSecret: !!config.electricSecret,
        });

        initElectric({
          url: config.electricUrl,
          sourceId: config.electricSourceId,
          secret: config.electricSecret,
        });
        logger.info("sync.electric", "Electric initialized", {
          electricUrl: config.electricUrl,
          authenticated: !!(config.electricSourceId && config.electricSecret),
        });

        if (config.electricSourceId && config.electricSecret) {
          logger.info("sync.electric", "Using Electric Cloud authentication");
        } else {
          logger.warn(
            "sync.electric",
            "No authentication - using local instance"
          );
        }

        setConfigLoaded(true);
        onReady();
      } catch (error) {
        logger.error("sync.electric", "Failed to load runtime config", {
          error,
        });
        // Fallback to build-time env vars
        const electricUrl =
          process.env.NEXT_PUBLIC_ELECTRIC_URL || "http://localhost:5133";
        const electricSourceId = process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_ID;
        const electricSecret = process.env.NEXT_PUBLIC_ELECTRIC_SOURCE_SECRET;

        logger.info("sync.electric", "Using fallback build-time config", {
          electricUrl,
        });

        initElectric({
          url: electricUrl,
          sourceId: electricSourceId,
          secret: electricSecret,
        });
        logger.info("sync.electric", "Electric initialized with fallback", {
          electricUrl,
          authenticated: !!(electricSourceId && electricSecret),
        });

        if (electricSourceId && electricSecret) {
          logger.info("sync.electric", "Using Electric Cloud authentication");
        } else {
          logger.warn(
            "sync.electric",
            "No authentication - using local instance"
          );
        }
        setConfigLoaded(true);
        onReady();
      }
    }

    // Initialize Electric for all users (guests and authenticated)
    initializeWithRuntimeConfig();

    // Skip FlushWorker initialization if guest
    if (isGuest) {
      logger.info("sync.electric", "Guest mode - skipping FlushWorker");

      // Clear write buffer in guest mode (prevents 401 errors from old pending changes)
      import("@deeprecall/data").then(({ getFlushWorker }) => {
        const flushWorker = getFlushWorker();
        if (flushWorker) {
          const buffer = flushWorker.getBuffer();
          buffer
            .clear()
            .then(() => {
              logger.info("auth", "Write buffer cleared for guest mode");
            })
            .catch((error) => {
              logger.error("auth", "Failed to clear write buffer", { error });
            });
        }
      });

      return;
    }

    // Only initialize FlushWorker for authenticated users
    if (!isAuthenticated) {
      return;
    }

    // Initialize and start FlushWorker (only for authenticated users)
    const apiBase = process.env.NEXT_PUBLIC_API_BASE || "";
    const worker = initFlushWorker({
      flushHandler: async (changes) => {
        try {
          const response = await fetch(`${apiBase}/api/writes/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ changes }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();
          return {
            applied: result.applied || [],
            errors: result.errors || [],
          };
        } catch (error) {
          logger.error("sync.writeBuffer", "FlushWorker API request failed", {
            error,
          });
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
    worker.start(1000); // Check every 1 second for responsive sync
    workerRef.current = worker;
    logger.info("sync.writeBuffer", "FlushWorker started", {
      interval: 1000,
      endpoint: `${apiBase}/api/writes/batch`,
    });

    // Expose for debugging in browser console
    if (typeof window !== "undefined") {
      (window as any).__deeprecall_flush_worker = worker;
      (window as any).__deeprecall_buffer = worker.getBuffer();
      logger.info(
        "sync.writeBuffer",
        "FlushWorker exposed to window.__deeprecall_flush_worker"
      );
      logger.info(
        "sync.writeBuffer",
        "Buffer exposed to window.__deeprecall_buffer"
      );
    }

    // Cleanup on unmount
    return () => {
      if (workerRef.current) {
        workerRef.current.stop();
        logger.info("sync.writeBuffer", "FlushWorker stopped");
      }
    };
  }, [isGuest, isAuthenticated, status]); // Re-run when auth status changes

  return null;
}

/**
 * SyncManager: Centralized Electric → Dexie sync coordinator
 *
 * CRITICAL: This component runs ALL sync hooks exactly ONCE to prevent race conditions.
 * - Subscribes to Electric shapes
 * - Syncs data to Dexie synced tables
 * - Runs cleanup on local tables
 *
 * Components should ONLY use read hooks (usePresets, useWorks, etc.)
 * which query merged data from Dexie without side effects.
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
