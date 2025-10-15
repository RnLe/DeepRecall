/**
 * React Query hooks for file/blob operations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FilesResponseSchema, type FilesResponse } from "@/src/schema/files";

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
    onSuccess: () => {
      // Invalidate files list after scan completes
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
  });
}
