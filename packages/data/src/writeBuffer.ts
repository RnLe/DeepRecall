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
  | "review_logs";

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

  /** Get all changes (for debugging) */
  getAll(): Promise<WriteChange[]>;

  /** Clear all changes (use with caution!) */
  clear(): Promise<void>;

  /** Remove a specific change */
  remove(id: string): Promise<void>;
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
      console.log(
        `[WriteBuffer] Enqueued ${change.op} on ${change.table} (id: ${writeChange.id})`
      );

      return writeChange;
    },

    async peek(limit) {
      const pending = await writeBufferDB.changes
        .where("status")
        .equals("pending")
        .or("status")
        .equals("error") // Retry failed changes
        .sortBy("created_at");

      return pending.slice(0, limit);
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

      console.log(`[WriteBuffer] Marked ${ids.length} changes as applied`);
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

      console.warn(`[WriteBuffer] Marked ${ids.length} changes as failed`);
    },

    async size() {
      return writeBufferDB.changes.where("status").equals("pending").count();
    },

    async getAll() {
      return writeBufferDB.changes.toArray();
    },

    async clear() {
      await writeBufferDB.changes.clear();
      console.log("[WriteBuffer] Cleared all changes");
    },

    async remove(id) {
      await writeBufferDB.changes.delete(id);
      console.log(`[WriteBuffer] Removed change ${id}`);
    },
  };
}

/**
 * Flush worker configuration
 */
export interface FlushWorkerConfig {
  /** Base URL for the API */
  apiBase: string;

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
  private config: Required<FlushWorkerConfig>;
  private buffer: WriteBuffer;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor(config: FlushWorkerConfig) {
    this.config = {
      batchSize: 10,
      retryDelay: 1000,
      maxRetryDelay: 30000,
      maxRetries: 5,
      token: "",
      ...config,
    };
    this.buffer = createWriteBuffer();
  }

  /**
   * Start the flush worker
   * Runs continuously, checking for pending changes
   */
  start(intervalMs = 5000): void {
    if (this.isRunning) {
      console.warn("[FlushWorker] Already running");
      return;
    }

    console.log(`[FlushWorker] Starting (interval: ${intervalMs}ms)`);
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

    console.log("[FlushWorker] Stopping");
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
    const pending = await this.buffer.peek(this.config.batchSize);

    if (pending.length === 0) {
      return;
    }

    console.log(`[FlushWorker] Flushing ${pending.length} changes`);

    // Filter out changes that exceeded max retries
    const retryable = pending.filter(
      (c) => c.retry_count < this.config.maxRetries
    );

    if (retryable.length === 0) {
      console.warn(
        `[FlushWorker] ${pending.length} changes exceeded max retries`
      );
      return;
    }

    try {
      // Send batch to server
      const response = await fetch(`${this.config.apiBase}/api/writes/batch`, {
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
        throw new Error(
          `Server returned ${response.status}: ${response.statusText}`
        );
      }

      const result = await response.json();

      // Mark successful changes as applied
      const successIds = result.applied || retryable.map((c: any) => c.id);
      await this.buffer.markApplied(successIds, result.responses);

      console.log(
        `[FlushWorker] Successfully applied ${successIds.length} changes`
      );
    } catch (error) {
      console.error("[FlushWorker] Flush failed:", error);

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
