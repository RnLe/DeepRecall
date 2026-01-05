/**
 * Folder Sources Cleanup Utility
 *
 * Removes local optimistic entries once Electric confirms server state.
 */

import type { FolderSource } from "@deeprecall/core";
import { logger } from "@deeprecall/telemetry";
import { db } from "../db";
import type { LocalFolderSourceChange } from "./folder-sources.local";

let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

export async function cleanupSyncedFolderSources(
  syncedSources: FolderSource[]
): Promise<void> {
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
  }

  await new Promise<void>((resolve) => {
    cleanupTimer = setTimeout(async () => {
      cleanupTimer = null;
      try {
        await performCleanup(syncedSources);
      } finally {
        resolve();
      }
    }, 120);
  });
}

async function performCleanup(syncedSources: FolderSource[]): Promise<void> {
  const localChanges = await db.folderSources_local.toArray();
  if (localChanges.length === 0) {
    return;
  }

  const syncedById = new Map(
    syncedSources.map((source) => [source.id, source])
  );
  let cleaned = 0;

  for (const change of localChanges) {
    const remote = syncedById.get(change.id);

    switch (change._op) {
      case "insert":
        if (remote) {
          await deleteLocalChange(change);
          cleaned++;
        }
        break;
      case "update":
        if (remote && hasRemoteSuperseded(change, remote)) {
          await deleteLocalChange(change);
          cleaned++;
        }
        break;
      case "delete":
        if (!remote) {
          await deleteLocalChange(change);
          cleaned++;
        }
        break;
    }
  }

  if (cleaned > 0) {
    logger.debug("sync.coordination", "Cleaned folder source locals", {
      count: cleaned,
    });
  }
}

function hasRemoteSuperseded(
  change: LocalFolderSourceChange,
  remote: FolderSource
): boolean {
  const remoteUpdatedAt = safeTimestamp(remote.updatedAt);
  const localUpdatedAt =
    safeTimestamp(change.data?.updatedAt) || change._timestamp;
  if (remoteUpdatedAt >= localUpdatedAt) {
    return true;
  }

  if (!change.data) {
    return false;
  }

  return Object.entries(change.data).every(([key, value]) => {
    if (key === "updatedAt" || key === "createdAt") {
      return true;
    }

    const remoteValue = (remote as Record<string, unknown>)[key];
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(remoteValue) === JSON.stringify(value);
    }
    return remoteValue === value;
  });
}

function safeTimestamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function deleteLocalChange(
  change: LocalFolderSourceChange
): Promise<void> {
  if (typeof change._localId === "number") {
    await db.folderSources_local.delete(change._localId);
    return;
  }

  await db.folderSources_local
    .where("id")
    .equals(change.id)
    .and((entry) => entry._timestamp === change._timestamp)
    .delete();
}
