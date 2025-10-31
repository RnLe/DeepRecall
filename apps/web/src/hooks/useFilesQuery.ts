/**
 * React Query hooks for file/blob operations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FilesResponseSchema,
  type FilesResponse,
} from "@deeprecall/core/schemas/files";
import { logger } from "@deeprecall/telemetry";

export function useFilesQuery() {
  return useQuery({
    queryKey: ["files"],
    queryFn: async (): Promise<FilesResponse> => {
      const response = await fetch("/api/files");
      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }
      const json = await response.json();
      return FilesResponseSchema.parse(json);
    },
    staleTime: 60_000, // 1 minute
  });
}

export function useScanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/scan", { method: "POST" });
      if (!response.ok) {
        throw new Error("Scan failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate all file/blob queries after scan completes
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["blobs"] });
      queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "blobs"] });

      // Log scan results
      logger.info("cas", "File scan completed", {
        newFiles: data.newFiles,
        editedFiles: data.editedFiles,
        relocatedFiles: data.relocatedFiles,
        missingFiles: data.missingFiles,
      });

      if (data.newFiles > 0) {
        logger.info("cas", "New files detected", { count: data.newFiles });
      }
      if (data.editedFiles > 0) {
        logger.warn("cas", "Edited files detected", {
          count: data.editedFiles,
        });
      }
      if (data.relocatedFiles > 0) {
        logger.info("cas", "Relocated files detected", {
          count: data.relocatedFiles,
        });
      }
      if (data.missingFiles > 0) {
        logger.error("cas", "Missing files detected", {
          count: data.missingFiles,
        });
      }
    },
  });
}
