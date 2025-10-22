/**
 * ElectricSQL client integration
 * Handles real-time sync of data from Postgres to local Dexie
 */

import { ShapeStream, Shape } from "@electric-sql/client";
import { useState, useEffect, useRef } from "react";

/**
 * Electric configuration
 */
interface ElectricConfig {
  url: string; // Electric sync service URL
  token?: string; // Optional auth token
}

let electricConfig: ElectricConfig | null = null;

/**
 * Initialize Electric connection
 * Call this once at app startup
 */
export function initElectric(config: ElectricConfig): void {
  electricConfig = config;
  console.log(`[Electric] Initialized with URL: ${config.url}`);
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
 * Shape specification for Electric
 */
export interface ShapeSpec<T = any> {
  /** Table name in Postgres */
  table: string;

  /** Optional WHERE clause for filtering */
  where?: string;

  /** Optional columns to select (default: all) */
  columns?: string[];

  /** Optional parser for type conversion */
  parser?: Record<string, (value: string) => unknown>;
}

/**
 * Shape result with loading state
 */
export interface ShapeResult<T> {
  /** Loading state */
  isLoading: boolean;

  /** Current data (undefined while loading) */
  data?: T[];

  /** Error if any */
  error?: Error;

  /** Sync status */
  syncStatus: "connecting" | "syncing" | "synced" | "error";
}

/**
 * React hook to subscribe to a shape
 * Automatically syncs changes from Postgres to local state
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

  const streamRef = useRef<ShapeStream | null>(null);
  const shapeRef = useRef<Shape | null>(null);

  useEffect(() => {
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

    console.log(
      `[Electric] Subscribing to shape: ${spec.table}${
        spec.where ? ` (${spec.where})` : ""
      }`
    );
    setSyncStatus("connecting");

    // Create shape stream
    const stream = new ShapeStream({
      url: shapeUrl,
      parser: spec.parser,
      headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
    });

    streamRef.current = stream;

    // Create shape (manages data updates)
    const shape = new Shape(stream);
    shapeRef.current = shape;

    // Subscribe to shape changes
    const unsubscribe = shape.subscribe((shapeData) => {
      console.log(
        `[Electric] Shape updated: ${spec.table} (${shapeData.length} rows)`
      );
      setData(shapeData as T[]);
      setIsLoading(false);
      setSyncStatus("synced");
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
        console.error(`[Electric] Shape error for ${spec.table}:`, err);
        setError(err as Error);
        setSyncStatus("error");
        setIsLoading(false);
      }
    );

    // Cleanup on unmount
    return () => {
      console.log(`[Electric] Unsubscribing from shape: ${spec.table}`);
      unsubscribe();
      if (streamRef.current) {
        // Note: ShapeStream doesn't have a close() method in v0.14
        // It will be cleaned up by garbage collection
      }
    };
  }, [spec.table, spec.where, spec.columns?.join(",")]);

  return {
    data,
    isLoading,
    error,
    syncStatus,
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

  console.log(
    `[Electric] Querying shape: ${spec.table}${
      spec.where ? ` (${spec.where})` : ""
    }`
  );

  // Create temporary stream and shape
  const stream = new ShapeStream({
    url: shapeUrl,
    parser: spec.parser,
    headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
  });

  const shape = new Shape(stream);

  // Wait for first data update
  return new Promise((resolve, reject) => {
    const unsubscribe = shape.subscribe((shapeData) => {
      resolve(shapeData as T[]);
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
