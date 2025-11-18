/**
 * Folder Sources Local Repository (Optimistic Layer)
 *
 * Stores folder ingestion sources immediately in Dexie for Desktop/Mobile
 * without requiring backend support yet. Sync to server will be added later.
 */

import { v4 as uuidv4 } from "uuid";
import {
  FolderSourceSchema,
  FolderSourceRegistrationSchema,
  type FolderSource,
  type FolderSourceRegistration,
  type FolderSourceStatus,
} from "@deeprecall/core";
import { db } from "../db";
import { getDeviceId } from "../utils/deviceId";
import { getUserId, isAuthenticated } from "../auth";
import { logger } from "@deeprecall/telemetry";
import { createWriteBuffer } from "../writeBuffer";

export interface LocalFolderSourceChange {
  _localId?: number;
  id: string;
  _op: "insert" | "update" | "delete";
  _status: "pending" | "syncing" | "synced" | "error";
  _timestamp: number;
  _error?: string;
  data?: Partial<FolderSource>;
}

const buffer = createWriteBuffer();

function parseBooleanFlag(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return undefined;
}

const envFlag =
  typeof process !== "undefined"
    ? parseBooleanFlag(
        process.env?.NEXT_PUBLIC_ENABLE_FOLDER_SOURCES_SYNC ??
          process.env?.ENABLE_FOLDER_SOURCES_SYNC
      )
    : undefined;

const globalFlag =
  typeof globalThis !== "undefined"
    ? parseBooleanFlag(
        (globalThis as { __DEEPRECALL_ENABLE_FOLDER_SOURCES_SYNC?: unknown })
          .__DEEPRECALL_ENABLE_FOLDER_SOURCES_SYNC
      )
    : undefined;

let remoteEnqueueEnabled = envFlag ?? globalFlag ?? false;

function applyRemoteEnqueueFlag(enabled: boolean, { log = true } = {}) {
  const changed = remoteEnqueueEnabled !== enabled;
  remoteEnqueueEnabled = enabled;

  if (typeof globalThis !== "undefined") {
    (globalThis as any).__DEEPRECALL_ENABLE_FOLDER_SOURCES_SYNC = enabled;
  }

  if (log && changed) {
    logger.info("sync.coordination", "Folder source remote enqueue flag set", {
      enabled,
    });
  }
}

applyRemoteEnqueueFlag(remoteEnqueueEnabled, { log: false });

export function setFolderSourcesRemoteEnqueueEnabled(enabled: boolean) {
  applyRemoteEnqueueFlag(enabled);
}

export function isFolderSourcesRemoteEnqueueEnabled() {
  return remoteEnqueueEnabled;
}

function nowIso() {
  return new Date().toISOString();
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function computePathHash(
  value?: string | null
): Promise<string | undefined> {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  if (typeof globalThis.crypto?.subtle !== "undefined") {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(normalized);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return bufferToHex(digest);
  }

  try {
    const { createHash } = await import("crypto");
    return createHash("sha256").update(normalized, "utf8").digest("hex");
  } catch (error) {
    logger.warn("sync.coordination", "Failed to compute path hash", {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

async function enqueueIfEnabled(
  table: "folder_sources",
  op: "insert" | "update" | "delete",
  payload: any
) {
  if (!remoteEnqueueEnabled || !isAuthenticated()) {
    return;
  }

  await buffer.enqueue({ table, op, payload });
}

async function recordLocalChange(change: LocalFolderSourceChange) {
  await db.folderSources_local.put({
    ...change,
    data: change.data as FolderSource | undefined,
  } as any);
}

async function ensureSingleDefault(deviceId: string, keepId: string) {
  const synced = await db.folderSources
    .where("deviceId")
    .equals(deviceId)
    .toArray();
  const conflictingSynced = synced
    .filter((entry) => entry.isDefault && entry.id !== keepId)
    .map((entry) => entry.id);

  const localChanges = await db.folderSources_local.toArray();
  const conflictingLocals = localChanges
    .filter(
      (change) =>
        change.id !== keepId &&
        change.data?.deviceId === deviceId &&
        change.data?.isDefault
    )
    .map((change) => change.id);

  const targets = [...new Set([...conflictingSynced, ...conflictingLocals])];

  const resetUpdates = targets.map((id) =>
    recordLocalChange({
      id,
      _op: "update",
      _status: "pending",
      _timestamp: Date.now(),
      data: {
        isDefault: false,
        updatedAt: nowIso(),
      },
    })
  );

  await Promise.all(resetUpdates);
}

export async function registerFolderSourceLocal(
  input: FolderSourceRegistration
): Promise<FolderSource> {
  const parsed = FolderSourceRegistrationSchema.parse(input);
  const ownerId = getUserId() ?? undefined;
  const deviceId = parsed.deviceId ?? getDeviceId();
  const pathHash = parsed.pathHash ?? (await computePathHash(parsed.path));

  const folderSource = FolderSourceSchema.parse({
    id: uuidv4(),
    kind: "folder_source",
    ownerId,
    deviceId,
    type: parsed.type,
    displayName: parsed.displayName,
    path: parsed.path,
    pathHash,
    uri: parsed.uri,
    priority: parsed.priority ?? 50,
    isDefault: parsed.isDefault ?? false,
    status: "idle" as FolderSourceStatus,
    metadata: parsed.metadata,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  if (folderSource.isDefault) {
    await ensureSingleDefault(deviceId, folderSource.id);
  }

  await recordLocalChange({
    id: folderSource.id,
    _op: "insert",
    _status: "pending",
    _timestamp: Date.now(),
    data: folderSource,
  });

  await enqueueIfEnabled("folder_sources", "insert", folderSource);

  logger.info("sync.coordination", "Registered folder source locally", {
    sourceId: folderSource.id,
    type: folderSource.type,
    syncEnabled: remoteEnqueueEnabled && isAuthenticated(),
  });

  return folderSource;
}

export async function updateFolderSourceLocal(
  id: string,
  updates: Partial<FolderSource>
): Promise<void> {
  const mergedUpdates: Partial<FolderSource> = {
    ...updates,
    updatedAt: nowIso(),
  };

  const pathProvided = Object.prototype.hasOwnProperty.call(updates, "path");
  const hashProvided = Object.prototype.hasOwnProperty.call(
    updates,
    "pathHash"
  );

  if (pathProvided && !hashProvided) {
    if (updates.path) {
      mergedUpdates.pathHash = await computePathHash(updates.path);
    } else if (updates.path === null) {
      mergedUpdates.pathHash = null;
    }
  }

  if (updates.isDefault) {
    const existingSynced = await db.folderSources
      .where("id")
      .equals(id)
      .first();
    let deviceId = existingSynced?.deviceId;

    if (!deviceId) {
      const localInsert = (
        await db.folderSources_local.where("id").equals(id).toArray()
      ).find((change) => change._op === "insert");
      deviceId = localInsert?.data?.deviceId;
    }

    await ensureSingleDefault(deviceId ?? getDeviceId(), id);
  }

  await recordLocalChange({
    id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: mergedUpdates,
  });

  await enqueueIfEnabled("folder_sources", "update", { id, ...mergedUpdates });
}

export async function removeFolderSourceLocal(id: string): Promise<void> {
  await recordLocalChange({
    id,
    _op: "delete",
    _status: "pending",
    _timestamp: Date.now(),
  });

  await enqueueIfEnabled("folder_sources", "delete", { id });
}

export async function markFolderSourceStatus(
  id: string,
  status: FolderSourceStatus,
  opts: { lastError?: string; partials?: Partial<FolderSource> } = {}
): Promise<void> {
  await recordLocalChange({
    id,
    _op: "update",
    _status: "pending",
    _timestamp: Date.now(),
    data: {
      status,
      lastError: opts.lastError,
      ...opts.partials,
      updatedAt: nowIso(),
    },
  });
}
