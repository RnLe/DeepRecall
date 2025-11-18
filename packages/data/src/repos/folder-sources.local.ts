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

const featureFlagValue =
  (typeof process !== "undefined" &&
    process.env?.NEXT_PUBLIC_ENABLE_FOLDER_SOURCES_SYNC) ??
  (typeof globalThis !== "undefined"
    ? (globalThis as any).__DEEPRECALL_ENABLE_FOLDER_SOURCES_SYNC
    : undefined);

const ENABLE_REMOTE_ENQUEUE =
  featureFlagValue === undefined
    ? true
    : featureFlagValue === true || featureFlagValue === "true";

function nowIso() {
  return new Date().toISOString();
}

async function enqueueIfEnabled(
  table: "folder_sources",
  op: "insert" | "update" | "delete",
  payload: any
) {
  if (!ENABLE_REMOTE_ENQUEUE || !isAuthenticated()) {
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

  const folderSource = FolderSourceSchema.parse({
    id: uuidv4(),
    kind: "folder_source",
    ownerId,
    deviceId,
    type: parsed.type,
    displayName: parsed.displayName,
    path: parsed.path,
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
    syncEnabled: ENABLE_REMOTE_ENQUEUE && isAuthenticated(),
  });

  return folderSource;
}

export async function updateFolderSourceLocal(
  id: string,
  updates: Partial<FolderSource>
): Promise<void> {
  const mergedUpdates = {
    ...updates,
    updatedAt: nowIso(),
  };

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
