/**
 * Experimental hooks for folder source registry
 */

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { logger } from "@deeprecall/telemetry";
import * as folderSourcesMerged from "../repos/folder-sources.merged";

const ENABLE_FOLDER_SOURCE_ELECTRIC = false; // Wire to env once backend table exists

export function useFolderSourcesSync(): null {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!ENABLE_FOLDER_SOURCE_ELECTRIC) {
      logger.debug(
        "sync.coordination",
        "Folder source Electric sync disabled (no backend table)"
      );
      return;
    }

    // Placeholder: Hook into Electric once folder_sources table exists
    queryClient.invalidateQueries({ queryKey: ["folderSources", "merged"] });
  }, [queryClient]);

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
