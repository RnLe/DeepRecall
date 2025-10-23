/**
 * React hooks for Authors using Electric + WriteBuffer
 * Platform-agnostic data access with real-time sync
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Author } from "@deeprecall/core";
import * as authorsElectric from "../repos/authors.electric";

// ============================================================================
// Query Hooks (Electric-based, live-synced)
// ============================================================================

/**
 * Hook to get all authors (live-synced from Postgres via Electric)
 */
export function useAuthors() {
  return authorsElectric.useAuthors();
}

/**
 * Hook to get a single author by ID (live-synced)
 */
export function useAuthor(id: string | undefined) {
  return authorsElectric.useAuthor(id);
}

/**
 * Hook to get multiple authors by IDs (live-synced)
 */
export function useAuthorsByIds(ids: string[]) {
  return authorsElectric.useAuthorsByIds(ids);
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to create a new author
 */
export function useCreateAuthor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Omit<Author, "id" | "kind" | "createdAt" | "updatedAt">
    ) => {
      return authorsElectric.createAuthor(data);
    },
    onSuccess: () => {
      // Electric shapes will auto-update
      queryClient.invalidateQueries({ queryKey: ["authors"] });
    },
  });
}

/**
 * Hook to update an existing author
 */
export function useUpdateAuthor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Author, "id" | "kind" | "createdAt">>;
    }) => {
      return authorsElectric.updateAuthor(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authors"] });
    },
  });
}

/**
 * Hook to delete an author
 */
export function useDeleteAuthor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return authorsElectric.deleteAuthor(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authors"] });
    },
  });
}

/**
 * Hook to find or create an author
 * Searches by name first, creates if not found
 */
export function useFindOrCreateAuthor() {
  const { data: allAuthors = [] } = useAuthors();
  const createAuthor = useCreateAuthor();

  return useMutation({
    mutationFn: async (data: {
      firstName: string;
      lastName: string;
      middleName?: string;
      orcid?: string;
    }) => {
      // Try to find existing author by name
      const existing = allAuthors.find(
        (a) =>
          a.firstName.toLowerCase() === data.firstName.toLowerCase() &&
          a.lastName.toLowerCase() === data.lastName.toLowerCase()
      );

      if (existing) {
        console.log(`[AuthorsHooks] Found existing author: ${existing.id}`);
        return existing;
      }

      // Create new author
      console.log(
        `[AuthorsHooks] Creating new author: ${data.firstName} ${data.lastName}`
      );
      return createAuthor.mutateAsync({
        ...data,
        affiliation: undefined,
      });
    },
  });
}
