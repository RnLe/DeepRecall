/**
 * React hooks for Edges using Electric + WriteBuffer
 * Platform-agnostic data access with real-time sync
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Edge, Relation } from "@deeprecall/core";
import * as edgesElectric from "../repos/edges.electric";

// ============================================================================
// Query Hooks (Electric-based, live-synced)
// ============================================================================

/**
 * Hook to get all edges (live-synced from Postgres via Electric)
 * Returns: { data, isLoading, error, syncStatus }
 */
export function useEdges() {
  return edgesElectric.useEdges();
}

/**
 * Hook to get a single edge by ID (live-synced)
 */
export function useEdge(id: string | undefined) {
  return edgesElectric.useEdge(id);
}

/**
 * Hook to get edges from a specific entity (live-synced)
 */
export function useEdgesFrom(fromId: string | undefined) {
  if (!fromId) {
    return {
      data: [],
      isLoading: false,
      error: null,
      syncStatus: "ready" as const,
    };
  }
  return edgesElectric.useEdgesFrom(fromId);
}

/**
 * Hook to get edges to a specific entity (live-synced)
 */
export function useEdgesTo(toId: string | undefined) {
  if (!toId) {
    return {
      data: [],
      isLoading: false,
      error: null,
      syncStatus: "ready" as const,
    };
  }
  return edgesElectric.useEdgesTo(toId);
}

/**
 * Hook to get edges by relation type (live-synced)
 */
export function useEdgesByRelation(fromId: string, relation: Relation) {
  return edgesElectric.useEdgesByRelation(fromId, relation);
}

// ============================================================================
// Mutation Hooks (WriteBuffer-based, optimistic)
// ============================================================================

/**
 * Hook to create a new edge
 * Writes to buffer immediately, syncs in background
 */
export function useCreateEdge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fromId,
      toId,
      relation,
      metadata,
      order,
    }: {
      fromId: string;
      toId: string;
      relation: Relation;
      metadata?: string;
      order?: number;
    }) => {
      return edgesElectric.createEdge(fromId, toId, relation, {
        metadata,
        order,
      });
    },
    onSuccess: (newEdge: Edge) => {
      console.log(
        `[useCreateEdge] Created edge ${newEdge.id} (${newEdge.relation}) (queued for sync)`
      );

      // Optimistically invalidate queries (Electric will sync back)
      queryClient.invalidateQueries({ queryKey: ["edges"] });
      queryClient.invalidateQueries({
        queryKey: ["edges", "from", newEdge.fromId],
      });
      queryClient.invalidateQueries({
        queryKey: ["edges", "to", newEdge.toId],
      });
    },
    onError: (error: Error) => {
      console.error("[useCreateEdge] Failed to create edge:", error);
    },
  });
}

/**
 * Hook to update an edge
 * Writes to buffer immediately, syncs in background
 */
export function useUpdateEdge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Edge, "id" | "kind" | "createdAt">>;
    }) => {
      await edgesElectric.updateEdge(id, updates);
      return { id, updates };
    },
    onSuccess: ({ id }: { id: string; updates: Partial<Edge> }) => {
      console.log(`[useUpdateEdge] Updated edge ${id} (queued for sync)`);

      // Optimistically invalidate queries
      queryClient.invalidateQueries({ queryKey: ["edges"] });
      queryClient.invalidateQueries({ queryKey: ["edge", id] });
    },
    onError: (error: Error) => {
      console.error("[useUpdateEdge] Failed to update edge:", error);
    },
  });
}

/**
 * Hook to delete an edge
 * Writes to buffer immediately, syncs in background
 */
export function useDeleteEdge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await edgesElectric.deleteEdge(id);
      return id;
    },
    onSuccess: (id: string) => {
      console.log(`[useDeleteEdge] Deleted edge ${id} (queued for sync)`);

      // Optimistically invalidate queries
      queryClient.invalidateQueries({ queryKey: ["edges"] });
      queryClient.invalidateQueries({ queryKey: ["edge", id] });
    },
    onError: (error: Error) => {
      console.error("[useDeleteEdge] Failed to delete edge:", error);
    },
  });
}

/**
 * Hook to delete edges between two entities
 * Note: This may require server-side batch delete support
 */
export function useDeleteEdgesBetween() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fromId, toId }: { fromId: string; toId: string }) => {
      await edgesElectric.deleteEdgesBetween(fromId, toId);
      return { fromId, toId };
    },
    onSuccess: ({ fromId, toId }: { fromId: string; toId: string }) => {
      console.log(
        `[useDeleteEdgesBetween] Deleted edges between ${fromId} and ${toId} (queued for sync)`
      );

      // Optimistically invalidate queries
      queryClient.invalidateQueries({ queryKey: ["edges"] });
      queryClient.invalidateQueries({ queryKey: ["edges", "from", fromId] });
      queryClient.invalidateQueries({ queryKey: ["edges", "to", toId] });
    },
    onError: (error: Error) => {
      console.error(
        "[useDeleteEdgesBetween] Failed to delete edges between entities:",
        error
      );
    },
  });
}
