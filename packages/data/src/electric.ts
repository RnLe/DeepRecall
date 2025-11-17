"use client";

/**
 * ElectricSQL client integration
 * Handles real-time sync of data from Postgres to local Dexie
 */

import { ShapeStream, Shape } from "@electric-sql/client";
import { useState, useEffect, useRef } from "react";
import { logger } from "@deeprecall/telemetry";

/**
 * Electric configuration
 */
interface ElectricConfig {
  url: string; // Electric sync service URL (e.g., https://api.electric-sql.cloud/v1/shape)
  token?: string; // Optional auth token (for self-hosted)
  sourceId?: string; // Electric Cloud source ID
  secret?: string; // Electric Cloud source secret
  mode?: "development" | "production"; // Sync mode
}

/**
 * Sync mode configuration
 * - development: 10s polling to catch sync delay issues
 * - production: Real-time SSE for instant updates
 *
 * CURRENT: Using development (polling) mode for Electric Cloud
 * REASON: liveSse (SSE) had reliability issues detecting live changes
 * RESULT: 10-second polling works perfectly with Electric Cloud
 */
const SYNC_MODE: "development" | "production" = "development";

/**
 * JSONB columns per table that need parsing
 * Maps table names to their JSONB column names (snake_case)
 */
const JSONB_COLUMNS_BY_TABLE: Record<string, string[]> = {
  presets: ["core_field_config", "custom_fields"],
  works: ["authors", "metadata"],
  annotations: ["geometry", "style", "metadata"],
  authors: ["avatar_crop_region"],
  // Add more tables as needed
};

/**
 * Convert snake_case to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert row keys from snake_case to camelCase and parse JSONB columns
 */
function parseJsonbColumns<T>(table: string, row: any): T {
  const jsonbColumns = JSONB_COLUMNS_BY_TABLE[table];

  let normalizedRow = row;

  if (normalizedRow && typeof normalizedRow.toJSON === "function") {
    normalizedRow = normalizedRow.toJSON();
  }

  if (normalizedRow instanceof Map) {
    normalizedRow = Object.fromEntries(normalizedRow.entries());
  }

  if (!normalizedRow || typeof normalizedRow !== "object") {
    normalizedRow = {};
  }

  const result: any = {};

  for (const [key, value] of Object.entries(normalizedRow)) {
    const camelKey = toCamelCase(key);

    if (jsonbColumns?.includes(key) && value && typeof value === "string") {
      try {
        result[camelKey] = JSON.parse(value);
      } catch (error) {
        logger.warn("sync.electric", "Failed to parse JSONB column", {
          table,
          column: key,
          error: error instanceof Error ? error.message : String(error),
        });
        result[camelKey] = value;
      }
    } else {
      result[camelKey] = value;
    }
  }

  return result as T;
}

function buildRowsFromSource<T>(table: string, rawRows: any[]): T[] {
  let parsedRows = rawRows.map((row) => parseJsonbColumns<T>(table, row));

  if (table === "annotations") {
    parsedRows = parsedRows.map(transformAnnotationFromPostgres) as T[];
  }

  return parsedRows as T[];
}

function normalizeShapeRows<T>(table: string, shapeData: any): T[] {
  if (Array.isArray(shapeData)) {
    return shapeData as T[];
  }

  if (shapeData instanceof Map) {
    const rowsFromMap = Array.from(shapeData.values());
    return buildRowsFromSource<T>(table, rowsFromMap);
  }

  if (shapeData && typeof shapeData === "object" && "rows" in shapeData) {
    const rowsArray = Array.isArray((shapeData as any).rows)
      ? (shapeData as any).rows
      : [];
    return buildRowsFromSource<T>(table, rowsArray);
  }

  return [];
}

/**
 * Transform annotation from Postgres schema to client schema
 * Postgres: { type, geometry, style, content, metadata, attached_assets, ... }
 * Client: { data: { type, rects/ranges }, metadata: { color, notes/title, ... }, ... }
 */
function transformAnnotationFromPostgres(row: any): any {
  const { type, geometry, style, content, metadata, attachedAssets, ...rest } =
    row;

  // Build data field (type + geometry)
  const data: any = { type };
  if (type === "rectangle") {
    data.rects = geometry?.rects || [];
  } else if (type === "highlight") {
    data.ranges = geometry?.ranges || [];
  }

  // Build metadata field (style + content + metadata + attachedAssets)
  const clientMetadata: any = {};
  if (style?.color) clientMetadata.color = style.color;

  // Content is notes (not title)
  if (content && typeof content === "string") {
    clientMetadata.notes = content;
  }

  // Merge Postgres metadata fields (includes title)
  if (metadata) {
    Object.assign(clientMetadata, metadata);
  }

  if (attachedAssets && attachedAssets.length > 0) {
    clientMetadata.attachedAssets = attachedAssets;
  }

  return {
    ...rest,
    data,
    metadata: clientMetadata,
  };
}

let electricConfig: ElectricConfig | null = null;

/**
 * Initialize Electric connection
 * Call this once at app startup
 */
export function initElectric(config: ElectricConfig): void {
  electricConfig = config;
  logger.info("sync.electric", "Initialized Electric", {
    url: config.url,
    mode: config.mode,
  });
}

/**
 * Get current Electric config
 */
export function getElectricConfig(): ElectricConfig {
  if (!electricConfig) {
    throw new Error("Electric not initialized. Call initElectric() first.");
  }
  return electricConfig;
}

/**
 * Clear all cached Electric connections
 * Useful for development/debugging or when resetting the database
 */
export function clearElectricCache(): void {
  logger.info("sync.electric", "Clearing cached connections", {
    count: shapeCache.size,
  });
  shapeCache.clear();
}

/**
 * Shape specification for Electric
 */
export interface ShapeSpec<T = any> {
  /** Table name in Postgres */
  table: string;

  /** Optional WHERE clause for filtering */
  where?: string;

  /** Optional columns to select (default: all) */
  columns?: string[];
}

/**
 * Shape result with loading state
 */
export interface ShapeResult<T = any> {
  /** Whether the shape is loading */
  isLoading: boolean;

  /** Current data (undefined while loading) */
  data?: T[];

  /** Error if any */
  error?: Error;

  /** Sync status */
  syncStatus: "connecting" | "syncing" | "synced" | "error";

  /** Whether data is fresh from network (not stale cache) */
  isFreshData: boolean;
}

/**
 * Shape cache to survive hot reloads
 * Maps shape key to { stream, shape, subscribers, lastUpdate }
 */
const shapeCache = new Map<
  string,
  {
    stream: ShapeStream;
    shape: Shape;
    subscribers: Set<(data: any[]) => void>;
    lastUpdateTime: number; // Track when data was last updated
    hasReceivedFreshData: boolean; // Track if we've received network update since connection
  }
>();

/**
 * Generate stable cache key for a shape
 */
function getShapeCacheKey(spec: ShapeSpec): string {
  const parts = [spec.table];
  if (spec.where) parts.push(spec.where);
  if (spec.columns) parts.push(spec.columns.join(","));
  return parts.join(":");
}

/**
 * React hook to subscribe to a shape
 * Automatically syncs changes from Postgres to local state
 * Uses cached connections to survive hot reloads
 *
 * @example
 * const { data, isLoading, syncStatus } = useShape<Work>({
 *   table: 'works',
 *   where: 'favorite = true',
 * });
 */
export function useShape<T = any>(spec: ShapeSpec<T>): ShapeResult<T> {
  const [data, setData] = useState<T[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [syncStatus, setSyncStatus] =
    useState<ShapeResult<T>["syncStatus"]>("connecting");
  const [isFreshData, setIsFreshData] = useState(false); // Track if data is fresh from network

  // Update system store when Electric connection status changes
  useEffect(() => {
    // Lazy import to avoid circular dependencies
    import("./stores/systemStore").then(({ useSystemStore }) => {
      const connected = syncStatus === "synced" || syncStatus === "syncing";
      useSystemStore.getState().setElectricConnected(connected);
    });
  }, [syncStatus]);

  const streamRef = useRef<ShapeStream | null>(null);
  const shapeRef = useRef<Shape | null>(null);

  const updateStateFromRows = (rowsData: T[], fresh: boolean) => {
    setData(rowsData);
    setIsLoading(false);
    setSyncStatus("synced");
    setIsFreshData(fresh);
  };

  useEffect(() => {
    const cacheKey = getShapeCacheKey(spec);
    let cached = shapeCache.get(cacheKey);

    // Reuse existing connection if available
    if (cached) {
      logger.debug("sync.electric", "Reusing cached shape", {
        table: spec.table,
        where: spec.where,
        hasFreshData: cached.hasReceivedFreshData,
      });
      streamRef.current = cached.stream;
      shapeRef.current = cached.shape;

      // Subscribe to existing shape
      const handleParsedRows = (parsedRows: any[]) => {
        updateStateFromRows(parsedRows as T[], true);
      };

      cached.subscribers.add(handleParsedRows);

      // Trigger immediate update with current data
      const currentData = cached.shape.currentValue;
      if (currentData) {
        const parsedRows = normalizeShapeRows<T>(spec.table, currentData);
        updateStateFromRows(parsedRows, cached.hasReceivedFreshData);
      }

      return () => {
        cached!.subscribers.delete(handleParsedRows);
      };
    }

    // Create new connection
    const config = getElectricConfig();

    // Build shape URL (Electric Cloud uses /v1/shape, self-hosted may vary)
    // Electric Cloud expects the full path in config.url
    let shapeUrl = config.url;

    // If URL doesn't end with /v1/shape, append it (for backward compatibility)
    if (!shapeUrl.includes("/v1/shape")) {
      shapeUrl = `${shapeUrl}/v1/shape`;
    }

    const params = new URLSearchParams({
      table: spec.table,
    });

    // Add Electric Cloud credentials as query params (if provided)
    if (config.sourceId) {
      params.append("source_id", config.sourceId);
    }
    if (config.secret) {
      params.append("secret", config.secret);
    }

    if (spec.where) {
      params.append("where", spec.where);
    }

    if (spec.columns) {
      params.append("columns", spec.columns.join(","));
    }

    shapeUrl += `?${params.toString()}`;

    logger.info("sync.electric", "Subscribing to shape", {
      table: spec.table,
      where: spec.where,
      mode: SYNC_MODE,
      shapeUrl,
    });
    setSyncStatus("connecting");

    // Create shape stream
    const stream = new ShapeStream({
      url: shapeUrl,
      headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
      liveSse: SYNC_MODE === "production", // Real-time SSE in production, polling in dev
    });

    streamRef.current = stream;

    // Create shape (manages data updates)
    const shape = new Shape(stream);
    shapeRef.current = shape;

    // Create subscriber set
    const subscribers = new Set<(data: any[]) => void>();

    const notifySubscribers = (parsedRows: T[]) => {
      subscribers.forEach((callback) => callback(parsedRows));
    };

    // Subscribe to shape changes
    const unsubscribe = shape.subscribe((shapeData) => {
      const parsedRows = normalizeShapeRows<T>(spec.table, shapeData);
      logger.debug("sync.electric", "Shape updated", {
        table: spec.table,
        rowCount: parsedRows.length,
      });

      updateStateFromRows(parsedRows, true);

      // Update last update time in cache
      const cached = shapeCache.get(cacheKey);
      if (cached) {
        cached.lastUpdateTime = Date.now();
        cached.hasReceivedFreshData = true; // Mark as having received fresh data
      }

      notifySubscribers(parsedRows);
    });

    // Handle errors
    stream.subscribe(
      (messages) => {
        // Success - data is being streamed
        if (messages.length > 0) {
          setSyncStatus("syncing");
        }
      },
      (err) => {
        // Suppress 409 Conflict errors (table truncated while shape active)
        // This happens during database clear operations and is expected
        const error = err as any;
        if (error.status === 409 || error.message?.includes("409")) {
          logger.info("sync.electric", "Shape conflict (table cleared)", {
            table: spec.table,
          });
          setSyncStatus("error");
          setIsLoading(false);
          return;
        }

        logger.error("sync.electric", "Shape error", {
          table: spec.table,
          error: err instanceof Error ? err.message : String(err),
          errorObject: err,
          stack: err instanceof Error ? err.stack : undefined,
        });
        setError(err as Error);
        setSyncStatus("error");
        setIsLoading(false);
      }
    );

    // Cache the connection
    shapeCache.set(cacheKey, {
      stream,
      shape,
      subscribers,
      lastUpdateTime: Date.now(),
      hasReceivedFreshData: false, // Will be set true on first network update
    });
    logger.debug("sync.electric", "Cached shape connection", { cacheKey });

    // Cleanup on unmount - DON'T close connection, keep it alive for cache
    return () => {
      // Connection stays alive in cache for hot reloads
      logger.debug(
        "sync.electric",
        "Component unmounted, keeping connection alive",
        {
          table: spec.table,
        }
      );
    };
  }, [spec.table, spec.where, spec.columns?.join(",")]);
  return {
    data,
    isLoading,
    error,
    syncStatus,
    isFreshData, // Expose freshness state to consumers
  };
}

/**
 * Get a one-time snapshot of a shape (no subscription)
 * Useful for initial data loading or one-off queries
 */
export async function queryShape<T = any>(spec: ShapeSpec<T>): Promise<T[]> {
  const config = getElectricConfig();

  // Build shape URL
  let shapeUrl = `${config.url}/v1/shape`;
  const params = new URLSearchParams({
    table: spec.table,
  });

  if (spec.where) {
    params.append("where", spec.where);
  }

  if (spec.columns) {
    params.append("columns", spec.columns.join(","));
  }

  shapeUrl += `?${params.toString()}`;

  logger.info("sync.electric", "Querying shape", {
    table: spec.table,
    where: spec.where,
  });

  // Create temporary stream and shape
  const stream = new ShapeStream({
    url: shapeUrl,
    headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
    liveSse: SYNC_MODE === "production", // Match subscription mode
  });

  const shape = new Shape(stream);

  // Wait for first data update
  return new Promise((resolve, reject) => {
    const unsubscribe = shape.subscribe((shapeData) => {
      const rows = shapeData.rows || [];

      // Parse JSONB columns
      let parsedRows = rows.map((row) => parseJsonbColumns<T>(spec.table, row));

      // Transform annotations from Postgres schema to client schema
      if (spec.table === "annotations") {
        parsedRows = parsedRows.map(transformAnnotationFromPostgres) as T[];
      }

      resolve(parsedRows);
      unsubscribe();
    });

    // Handle errors
    stream.subscribe(
      () => {}, // Ignore messages
      (err) => {
        reject(err);
        unsubscribe();
      }
    );
  });
}
