/**
 * Folder Sources - Electric (sync) layer
 * Subscribes to Electric shapes so Dexie can stay authoritative for merged view.
 */

import type { FolderSource } from "@deeprecall/core";
import { useShape } from "../electric";

export function useFolderSources(ownerId?: string) {
  return useShape<FolderSource>({
    table: "folder_sources",
    where: ownerId ? `owner_id = '${ownerId}'` : "1=0",
  });
}
