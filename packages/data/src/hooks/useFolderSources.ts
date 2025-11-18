/**
 * Folder source hooks and sync wiring
 */

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { logger } from "@deeprecall/telemetry";
import type { FolderSource } from "@deeprecall/core";
import * as folderSourcesMerged from "../repos/folder-sources.merged";
import * as folderSourcesElectric from "../repos/folder-sources.electric";
import type { MergedFolderSource } from "../repos/folder-sources.merged";
import { db } from "../db";

const ACTIVE_STATUSES = new Set(["idle", "scanning", "syncing", "degraded"]);

async function syncElectricToDexie(data: FolderSource[]): Promise<void> {
  await db.transaction("rw", db.folderSources, async () => {
    const existingIds = new Set(
      (await db.folderSources.toCollection().primaryKeys()) as string[]
    );
    const nextIds = new Set(data.map((source) => source.id));
    const toDelete = Array.from(existingIds).filter((id) => !nextIds.has(id));

    if (toDelete.length > 0) {
      await db.folderSources.bulkDelete(toDelete);
      logger.info("sync.electric", "Removed stale folder sources", {
        count: toDelete.length,
      });
    }

    if (data.length > 0) {
      await db.folderSources.bulkPut(data);
    }

    if (data.length === 0 && toDelete.length === 0) {
      await db.folderSources.clear();
    }
  });
}

export function useFolderSourcesSync(userId?: string): null {
  const queryClient = useQueryClient();
  const electricResult = folderSourcesElectric.useFolderSources(userId);

  useEffect(() => {
    if (!userId) {
      logger.debug(
        "sync.electric",
        "Folder source sync idle (guest or missing userId)"
      );
      return;
    }

    if (electricResult.isLoading || electricResult.data === undefined) {
      return;
    }

    syncElectricToDexie(electricResult.data)
      .then(() => {
        queryClient.invalidateQueries({
          queryKey: ["folderSources", "merged"],
        });
      })
      .catch((error) => {
        if (error?.name === "DatabaseClosedError") return;
        logger.error("sync.electric", "Failed to sync folder sources", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }, [electricResult.data, electricResult.isLoading, queryClient, userId]);

  return null;
}

export function useFolderSources() {
  return useQuery({
    queryKey: ["folderSources", "merged"],
    queryFn: () => folderSourcesMerged.getAllMergedFolderSources(),
    staleTime: 0,
    placeholderData: [],
  });
}

export function resolveDefaultFolderSource(
  sources: MergedFolderSource[],
  deviceId: string,
  opts: { allowCrossDeviceFallback?: boolean } = {}
): MergedFolderSource | undefined {
  const { allowCrossDeviceFallback = true } = opts;
  const activeSources = sources.filter((source) =>
    source.status ? ACTIVE_STATUSES.has(source.status) : true
  );

  const sameDevice = activeSources.filter(
    (source) => source.deviceId === deviceId
  );

  const prioritizedSort = (a: MergedFolderSource, b: MergedFolderSource) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  };

  const explicitDefault = sameDevice.find((source) => source.isDefault);
  if (explicitDefault) {
    return explicitDefault;
  }

  if (sameDevice.length > 0) {
    return [...sameDevice].sort(prioritizedSort)[0];
  }

  if (allowCrossDeviceFallback && activeSources.length > 0) {
    return [...activeSources].sort(prioritizedSort)[0];
  }

  return undefined;
}
