/**
 * React Query hooks for Author entities
 *
 * Provides optimistic updates, caching, and synchronization for author data.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { Author } from "@deeprecall/core/schemas/library";
import {
  createAuthor,
  deleteAuthor,
  findOrCreateAuthor,
  getAuthor,
  getAuthors,
  getAuthorStats,
  listAuthors,
  searchAuthors,
  updateAuthor,
} from "@deeprecall/data/repos/authors";

/**
 * Simple debounce hook
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Query key factory for authors
 */
export const authorKeys = {
  all: ["authors"] as const,
  lists: () => [...authorKeys.all, "list"] as const,
  list: (filters?: unknown) => [...authorKeys.lists(), filters] as const,
  details: () => [...authorKeys.all, "detail"] as const,
  detail: (id: string) => [...authorKeys.details(), id] as const,
  search: (query: string) => [...authorKeys.all, "search", query] as const,
  stats: (id: string) => [...authorKeys.all, "stats", id] as const,
};

/**
 * Hook to fetch a single author by ID
 */
export function useAuthor(id: string | undefined) {
  return useQuery({
    queryKey: authorKeys.detail(id!),
    queryFn: () => getAuthor(id!),
    enabled: !!id,
  });
}

/**
 * Hook to fetch multiple authors by IDs
 */
export function useAuthorsByIds(ids: string[]) {
  return useQuery({
    queryKey: [...authorKeys.all, "byIds", ids],
    queryFn: () => getAuthors(ids),
    enabled: ids.length > 0,
  });
}

/**
 * Hook to list all authors
 */
export function useListAuthors(options?: {
  sortBy?: "lastName" | "firstName" | "createdAt";
  reverse?: boolean;
  limit?: number;
}) {
  return useQuery({
    queryKey: authorKeys.list(options),
    queryFn: () => listAuthors(options),
  });
}

/**
 * Hook to search authors with debouncing
 */
export function useSearchAuthors(
  query: string,
  options?: { limit?: number; debounceMs?: number }
) {
  const debouncedQuery = useDebounce(query, options?.debounceMs ?? 300);

  return useQuery({
    queryKey: authorKeys.search(debouncedQuery),
    queryFn: () => searchAuthors(debouncedQuery, { limit: options?.limit }),
  });
}

/**
 * Hook to get author statistics
 */
export function useAuthorStats(id: string | undefined) {
  return useQuery({
    queryKey: authorKeys.stats(id!),
    queryFn: () => getAuthorStats(id!),
    enabled: !!id,
  });
}

/**
 * Hook to create a new author
 */
export function useCreateAuthor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: Omit<Author, "id" | "kind" | "createdAt" | "updatedAt">
    ) => createAuthor(data),
    onSuccess: (newAuthor) => {
      // Invalidate and refetch lists
      queryClient.invalidateQueries({ queryKey: authorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: authorKeys.all });

      // Set the new author in cache
      queryClient.setQueryData(authorKeys.detail(newAuthor.id), newAuthor);
    },
  });
}

/**
 * Hook to update an existing author
 */
export function useUpdateAuthor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Author, "id" | "kind" | "createdAt">>;
    }) => updateAuthor(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: authorKeys.detail(id) });

      // Snapshot previous value
      const previous = queryClient.getQueryData<Author>(authorKeys.detail(id));

      // Optimistically update
      if (previous) {
        queryClient.setQueryData<Author>(authorKeys.detail(id), {
          ...previous,
          ...updates,
          updatedAt: new Date().toISOString(),
        });
      }

      return { previous };
    },
    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(authorKeys.detail(id), context.previous);
      }
    },
    onSettled: (data, error, { id }) => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: authorKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: authorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: authorKeys.all });
    },
  });
}

/**
 * Hook to delete an author
 */
export function useDeleteAuthor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAuthor(id),
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: authorKeys.detail(id) });

      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: authorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: authorKeys.all });
    },
  });
}

/**
 * Hook to find or create an author (deduplication)
 */
export function useFindOrCreateAuthor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      firstName: string;
      lastName: string;
      middleName?: string;
      title?: string;
      affiliation?: string;
      orcid?: string;
      contact?: string;
      website?: string;
      bio?: string;
    }) => findOrCreateAuthor(data),
    onSuccess: (author) => {
      // Update cache
      queryClient.setQueryData(authorKeys.detail(author.id), author);
      queryClient.invalidateQueries({ queryKey: authorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: authorKeys.all });
    },
  });
}

/**
 * Hook for managing multiple authors in a form
 * Provides convenient state management for author arrays
 */
export function useAuthorList(initialAuthors: string[] = []) {
  const [authorIds, setAuthorIds] = useState<string[]>(initialAuthors);

  const { data: authors = [] } = useAuthorsByIds(authorIds);

  const addAuthor = (authorId: string) => {
    if (!authorIds.includes(authorId)) {
      setAuthorIds([...authorIds, authorId]);
    }
  };

  const removeAuthor = (authorId: string) => {
    setAuthorIds(authorIds.filter((id) => id !== authorId));
  };

  const reorderAuthors = (from: number, to: number) => {
    const newOrder = [...authorIds];
    const [removed] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, removed);
    setAuthorIds(newOrder);
  };

  const clearAuthors = () => {
    setAuthorIds([]);
  };

  return {
    authorIds,
    authors,
    addAuthor,
    removeAuthor,
    reorderAuthors,
    clearAuthors,
    setAuthorIds,
  };
}

/**
 * Hook for autocomplete author search with debouncing
 */
export function useAuthorAutocomplete(options?: {
  limit?: number;
  debounceMs?: number;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, options?.debounceMs ?? 300);

  const { data: results = [], isLoading } = useQuery({
    queryKey: authorKeys.search(debouncedQuery),
    queryFn: () => searchAuthors(debouncedQuery, { limit: options?.limit }),
  });

  // Sort results to show most relevant first
  const sortedResults = useMemo(() => {
    if (!debouncedQuery) return results;

    const lowerQuery = debouncedQuery.toLowerCase();

    return [...results].sort((a, b) => {
      const aLastName = a.lastName.toLowerCase();
      const bLastName = b.lastName.toLowerCase();
      const aFirstName = a.firstName.toLowerCase();
      const bFirstName = b.firstName.toLowerCase();

      // Prioritize exact matches
      if (aLastName === lowerQuery) return -1;
      if (bLastName === lowerQuery) return 1;
      if (aFirstName === lowerQuery) return -1;
      if (bFirstName === lowerQuery) return 1;

      // Then prioritize starts-with
      if (aLastName.startsWith(lowerQuery) && !bLastName.startsWith(lowerQuery))
        return -1;
      if (bLastName.startsWith(lowerQuery) && !aLastName.startsWith(lowerQuery))
        return 1;

      // Finally alphabetical
      return aLastName.localeCompare(bLastName);
    });
  }, [results, debouncedQuery]);

  return {
    searchQuery,
    setSearchQuery,
    results: sortedResults,
    isLoading: isLoading && searchQuery === debouncedQuery,
  };
}
