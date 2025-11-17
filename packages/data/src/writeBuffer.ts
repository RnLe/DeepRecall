/**
 * Write Buffer - Offline-first optimistic write queue
 * Stores local changes and syncs them to the server when online
 *
 * Architecture:
 * - Writes go to local buffer (Dexie table)
 * - Flush worker drains buffer to server API
 * - Server applies changes to Postgres
 * - Electric syncs changes back to clients
 * - Reconciliation layer merges server updates
 */

import Dexie, { type EntityTable } from "dexie";
import { v4 as uuidv4 } from "uuid";
import type { z } from "zod";
import { logger } from "@deeprecall/telemetry";

/**
 * Write operation types
 */
export type WriteOperation = "insert" | "update" | "delete";

/**
 * Write status
 */
export type WriteStatus = "pending" | "syncing" | "applied" | "error";

/**
 * Table names for writes
 */
export type WriteTable =
  | "works"
  | "assets"
  | "activities"
  | "collections"
  | "edges"
  | "presets"
  | "authors"
  | "annotations"
  | "cards"
  | "review_logs"
  | "blobs_meta"
  | "device_blobs"
  | "replication_jobs"
  | "boards"
  | "strokes";

/**
 * A single write change to be synced
 */
export interface WriteChange {
  /** Unique ID for this change */
  id: string;

  /** Target table */
  table: WriteTable;

  /** Operation type */
  op: WriteOperation;

  /** Payload data (validated by Zod before enqueue) */
  payload: any;

  /** When this change was created (client time, epoch ms) */
  created_at: number;

  /** Status of this write */
  status: WriteStatus;

  /** When this was applied on server (null until successful) */
  applied_at?: number;

  /** Server response if applied */
  server_response?: any;

  /** Error message if failed */
  error?: string;

  /** Retry count */
  retry_count: number;

  /** Last attempt timestamp */
  last_attempt_at?: number;
}

/**
 * Write buffer database (separate from main Dexie DB)
 */
class WriteBufferDB extends Dexie {
  changes!: EntityTable<WriteChange, "id">;

  constructor() {
    super("DeepRecallWriteBuffer");

    this.version(1).stores({
      changes: "id, status, table, created_at, applied_at",
    });
  }
}

// Singleton instance
const writeBufferDB = new WriteBufferDB();

/**
 * Write buffer interface
 */
export interface WriteBuffer {
  /** Add a new change to the buffer */
  enqueue(
    change: Omit<WriteChange, "id" | "created_at" | "status" | "retry_count">
  ): Promise<WriteChange>;

  /** Get pending changes (not removed from queue) */
  peek(limit: number): Promise<WriteChange[]>;

  /** Mark changes as applied */
  markApplied(ids: string[], serverResponses?: any[]): Promise<void>;

  /** Mark changes as failed */
  markFailed(ids: string[], errors: string[]): Promise<void>;

  /** Get total number of pending changes */
  size(): Promise<number>;

  /** Manually flush pending changes to server */
  flush(): Promise<void>;

  /** Get all changes (for debugging) */
  getAll(): Promise<WriteChange[]>;

  /** Clear all changes (use with caution!) */
  clear(): Promise<void>;

  /** Remove a specific change */
  remove(id: string): Promise<void>;

  /** Get detailed stats about the buffer */
  getStats(): Promise<{
    total: number;
    byStatus: Record<WriteStatus, number>;
    byTable: Record<string, number>;
    maxRetries: number;
    stuckChanges: WriteChange[];
  }>;

  /** Clear all failed/stuck changes */
  clearFailed(): Promise<number>;
}

/**
 * Create write buffer instance
 */
export function createWriteBuffer(): WriteBuffer {
  return {
    async enqueue(change) {
      const writeChange: WriteChange = {
        id: uuidv4(),
        ...change,
        created_at: Date.now(),
        status: "pending",
        retry_count: 0,
      };

      await writeBufferDB.changes.add(writeChange);
      logger.info("sync.writeBuffer", "Operation enqueued", {
        table: change.table,
        op: change.op,
        changeId: writeChange.id,
      });

      return writeChange;
    },

    async peek(limit) {
      const pending = await writeBufferDB.changes
        .where("status")
        .equals("pending")
        .or("status")
        .equals("error") // Retry failed changes
        .sortBy("created_at");

      // Filter out changes that exceeded max retries (shouldn't be in peek)
      const retryable = pending.filter((c) => c.retry_count < 5);

      return retryable.slice(0, limit);
    },

    async markApplied(ids, serverResponses) {
      const updates = ids.map((id, index) => ({
        id,
        status: "applied" as WriteStatus,
        applied_at: Date.now(),
        server_response: serverResponses?.[index],
      }));

      for (const update of updates) {
        await writeBufferDB.changes.update(update.id, update);
      }

      logger.info("sync.writeBuffer", "Changes marked as applied", {
        count: ids.length,
      });
    },

    async markFailed(ids, errors) {
      const updates = ids.map((id, index) => ({
        id,
        status: "error" as WriteStatus,
        error: errors[index],
        last_attempt_at: Date.now(),
      }));

      for (const update of updates) {
        const existing = await writeBufferDB.changes.get(update.id);
        if (existing) {
          await writeBufferDB.changes.update(update.id, {
            ...update,
            retry_count: existing.retry_count + 1,
          });
        }
      }

      logger.warn("sync.writeBuffer", "Changes marked as failed", {
        count: ids.length,
        errors: errors.slice(0, 3), // Log first 3 errors
      });
    },

    async size() {
      return writeBufferDB.changes.where("status").equals("pending").count();
    },

    async getAll() {
      return writeBufferDB.changes.toArray();
    },

    async clear() {
      await writeBufferDB.changes.clear();
      logger.info("sync.writeBuffer", "Buffer cleared");
    },

    async remove(id) {
      await writeBufferDB.changes.delete(id);
      logger.debug("sync.writeBuffer", "Change removed", { changeId: id });
    },

    /**
     * Get detailed stats about the buffer
     */
    async getStats() {
      const all = await writeBufferDB.changes.toArray();
      const byStatus = {
        pending: all.filter((c) => c.status === "pending").length,
        syncing: all.filter((c) => c.status === "syncing").length,
        applied: all.filter((c) => c.status === "applied").length,
        error: all.filter((c) => c.status === "error").length,
      };
      const byTable = all.reduce(
        (acc, c) => {
          acc[c.table] = (acc[c.table] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
      const maxRetries = Math.max(...all.map((c) => c.retry_count), 0);

      return {
        total: all.length,
        byStatus,
        byTable,
        maxRetries,
        stuckChanges: all.filter((c) => c.retry_count >= 5),
      };
    },

    /**
     * Clear all failed/stuck changes
     */
    async clearFailed() {
      const failed = await writeBufferDB.changes
        .where("status")
        .equals("error")
        .toArray();

      for (const change of failed) {
        await writeBufferDB.changes.delete(change.id);
      }

      logger.info("sync.writeBuffer", "Failed changes cleared", {
        count: failed.length,
      });
      return failed.length;
    },

    /**
     * Manually flush pending changes to server
     * Uses the global FlushWorker if available
     */
    async flush() {
      const worker = getFlushWorker();
      if (worker) {
        await worker.flush();
      } else {
        logger.warn(
          "sync.writeBuffer",
          "No FlushWorker initialized, changes will flush on next scheduled interval"
        );
      }
    },
  };
}

/**
 * Flush worker configuration
 */
export interface FlushWorkerConfig {
  /** Base URL for the API (optional if using custom flushHandler) */
  apiBase?: string;

  /** Custom flush handler (e.g., for Tauri commands) */
  flushHandler?: (changes: WriteChange[]) => Promise<{
    applied: string[];
    errors: Array<{ id: string; error: string }>;
  }>;

  /** Batch size for flushing */
  batchSize?: number;

  /** Initial retry delay (ms) */
  retryDelay?: number;

  /** Max retry delay (ms) */
  maxRetryDelay?: number;

  /** Max retry count before giving up */
  maxRetries?: number;

  /** Auth token for API requests */
  token?: string;
}

/**
 * Flush worker - drains write buffer to server
 * Uses exponential backoff for retries
 */
export class FlushWorker {
  private config: FlushWorkerConfig & {
    batchSize: number;
    retryDelay: number;
    maxRetryDelay: number;
    maxRetries: number;
    token: string;
  };
  private buffer: WriteBuffer;
  private isRunning = false;
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(config: FlushWorkerConfig) {
    this.config = {
      ...config,
      batchSize: config.batchSize ?? 10,
      retryDelay: config.retryDelay ?? 1000,
      maxRetryDelay: config.maxRetryDelay ?? 30000,
      maxRetries: config.maxRetries ?? 5,
      token: config.token ?? "",
    };
    this.buffer = createWriteBuffer();
  }

  /**
   * Start the flush worker
   * Runs continuously, checking for pending changes
   */
  start(intervalMs = 5000): void {
    if (this.isRunning) {
      logger.warn("sync.writeBuffer", "FlushWorker already running");
      return;
    }

    logger.info("sync.writeBuffer", "FlushWorker started", { intervalMs });
    this.isRunning = true;

    // Immediate first flush
    this.flush();

    // Then periodic flushes
    this.intervalId = setInterval(() => {
      this.flush();
    }, intervalMs);
  }

  /**
   * Stop the flush worker
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info("sync.writeBuffer", "FlushWorker stopped");
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Flush pending changes to server
   */
  async flush(): Promise<void> {
    logger.debug("sync.writeBuffer", "FlushWorker.flush() called");
    const pending = await this.buffer.peek(this.config.batchSize);
    logger.debug("sync.writeBuffer", "FlushWorker pending check", {
      pendingCount: pending.length,
    });

    if (pending.length === 0) {
      // Check if there are stuck changes and clean them up
      const stats = await this.buffer.getStats();
      if (stats.stuckChanges.length > 0) {
        logger.warn("sync.writeBuffer", "Found stuck changes, clearing", {
          stuckCount: stats.stuckChanges.length,
        });
        await this.buffer.clearFailed();
        logger.info("sync.writeBuffer", "Stuck changes cleared");
      }
      return;
    }

    logger.info("sync.writeBuffer", "Flush started", {
      batchSize: pending.length,
    });

    // Filter out changes that exceeded max retries
    const retryable = pending.filter(
      (c) => c.retry_count < this.config.maxRetries
    );

    if (retryable.length === 0) {
      logger.warn("sync.writeBuffer", "All changes exceeded max retries", {
        count: pending.length,
      });
      // Clear them instead of leaving them stuck
      for (const change of pending) {
        await this.buffer.remove(change.id);
        logger.error("sync.writeBuffer", "Removed stuck change", {
          changeId: change.id,
          table: change.table,
          op: change.op,
          retries: change.retry_count,
          error: change.error,
        });
      }
      return;
    }

    try {
      let result: {
        applied: string[];
        errors: Array<{ id: string; error: string }>;
      };

      // Use custom flush handler if provided (e.g., Tauri command)
      if (this.config.flushHandler) {
        logger.info("sync.writeBuffer", "Using custom flush handler", {
          changeCount: retryable.length,
        });
        result = await this.config.flushHandler(retryable);
        logger.info("sync.writeBuffer", "Custom flush handler returned", {
          appliedCount: result.applied?.length || 0,
          errorCount: result.errors?.length || 0,
        });
      } else {
        // Use HTTP API (web app)
        if (!this.config.apiBase) {
          throw new Error("No apiBase or flushHandler configured");
        }

        const url = `${this.config.apiBase}/api/writes/batch`;
        logger.info("sync.writeBuffer", "POSTing to batch API", {
          url,
          changeCount: retryable.length,
        });

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.config.token
              ? { Authorization: `Bearer ${this.config.token}` }
              : {}),
          },
          body: JSON.stringify({
            changes: retryable,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error("sync.writeBuffer", "Server error during flush", {
            status: response.status,
            statusText: response.statusText,
            errorText,
          });
          throw new Error(
            `Server returned ${response.status}: ${response.statusText}`
          );
        }

        result = await response.json();
      }

      logger.debug("sync.writeBuffer", "Flush response received", {
        appliedCount: result.applied?.length || 0,
        errorCount: result.errors?.length || 0,
      });

      // Check if there were errors
      if (result.errors && result.errors.length > 0) {
        logger.error("sync.writeBuffer", "Server reported errors", {
          errorCount: result.errors.length,
          errors: result.errors.slice(0, 3), // First 3 errors for context
        });

        // Mark failed changes as failed
        const failedIds = result.errors.map((e: any) => e.id);
        const errorMessages = result.errors.map((e: any) => e.error);
        await this.buffer.markFailed(failedIds, errorMessages);

        logger.warn("sync.writeBuffer", "Marked changes as failed", {
          count: failedIds.length,
        });
      }

      // Mark successful changes as applied
      const successIds = result.applied || [];
      if (successIds.length > 0) {
        await this.buffer.markApplied(successIds);
        logger.info("sync.writeBuffer", "Successfully applied changes", {
          count: successIds.length,
        });
      } else {
        logger.warn(
          "sync.writeBuffer",
          "No changes were successfully applied",
          {}
        );
      }
    } catch (error) {
      logger.error("sync.writeBuffer", "Flush failed", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        changeCount: retryable.length,
      });

      // Mark all as failed (will be retried with exponential backoff)
      const ids = retryable.map((c) => c.id);
      const errors = retryable.map(() => String(error));
      await this.buffer.markFailed(ids, errors);
    }
  }

  /**
   * Get write buffer instance
   */
  getBuffer(): WriteBuffer {
    return this.buffer;
  }
}

/**
 * Create a singleton flush worker
 */
let globalFlushWorker: FlushWorker | null = null;

export function initFlushWorker(config: FlushWorkerConfig): FlushWorker {
  if (globalFlushWorker) {
    globalFlushWorker.stop();
  }

  globalFlushWorker = new FlushWorker(config);
  return globalFlushWorker;
}

export function getFlushWorker(): FlushWorker | null {
  return globalFlushWorker;
}
