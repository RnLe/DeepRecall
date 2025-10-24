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
  const result: any = {};

  for (const [key, value] of Object.entries(row)) {
    const camelKey = toCamelCase(key);

    // Parse JSONB columns
    if (jsonbColumns?.includes(key) && value && typeof value === "string") {
      try {
        result[camelKey] = JSON.parse(value);
      } catch (error) {
        console.warn(
          `[Electric] Failed to parse JSONB column ${key} in ${table}:`,
          error
        );
        result[camelKey] = value;
      }
    } else {
      result[camelKey] = value;
    }
  }

  return result as T;
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
      headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
    });

    streamRef.current = stream;

    // Create shape (manages data updates)
    const shape = new Shape(stream);
    shapeRef.current = shape;

    // Subscribe to shape changes
    const unsubscribe = shape.subscribe((shapeData) => {
      // Shape.subscribe returns { value: Map, rows: Array }
      // Use rows array directly
      const rows = shapeData.rows || [];
      console.log(
        `[Electric] Shape updated: ${spec.table} (${rows.length} rows)`
      );

      // Parse JSONB columns
      let parsedRows = rows.map((row) => parseJsonbColumns<T>(spec.table, row));

      // Transform annotations from Postgres schema to client schema
      if (spec.table === "annotations") {
        parsedRows = parsedRows.map(transformAnnotationFromPostgres) as T[];
      }

      setData(parsedRows);
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
        // Suppress 409 Conflict errors (table truncated while shape active)
        // This happens during database clear operations and is expected
        const error = err as any;
        if (error.status === 409 || error.message?.includes("409")) {
          console.log(
            `[Electric] Shape conflict for ${spec.table} (table cleared)`
          );
          setSyncStatus("error");
          setIsLoading(false);
          return;
        }

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
    headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
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
