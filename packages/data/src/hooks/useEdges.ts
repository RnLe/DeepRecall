/**
 * React hooks for Edges using Two-Layer Architecture
 * - Read: Merged data (synced + local) for instant feedback
 * - Write: Local layer (optimistic) with background sync
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Edge, Relation } from "@deeprecall/core";
import * as edgesElectric from "../repos/edges.electric";
import * as edgesLocal from "../repos/edges.local";
import * as edgesMerged from "../repos/edges.merged";
import * as edgesCleanup from "../repos/edges.cleanup";
import { db } from "../db";
import { useEffect } from "react";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sync Electric data to Dexie edges table
 * Replaces entire table to ensure deletions are reflected
 *
 * CRITICAL: Must handle empty arrays to clear stale data
 */
async function syncElectricToDexie(electricData: Edge[]): Promise<void> {
  await db.transaction("rw", db.edges, async () => {
    // Get current IDs in Dexie
    const currentIds = new Set(await db.edges.toCollection().primaryKeys());

    // Get IDs from Electric
    const electricIds = new Set(electricData.map((e) => e.id));

    // Find IDs to delete (in Dexie but not in Electric)
    const idsToDelete = Array.from(currentIds).filter(
      (id) => !electricIds.has(id)
    );

    // Delete stale records
    if (idsToDelete.length > 0) {
      await db.edges.bulkDelete(idsToDelete);
      console.log(
        `[Electric→Dexie] Deleted ${idsToDelete.length} stale edge(s)`
      );
    }

    // Add/update records from Electric
    if (electricData.length > 0) {
      await db.edges.bulkPut(electricData);
      console.log(`[Electric→Dexie] Synced ${electricData.length} edge(s)`);
    }

    // Log final state
    if (idsToDelete.length === 0 && electricData.length === 0) {
      console.log(`[Electric→Dexie] Edges table cleared (0 rows)`);
    }
  });
}

// ============================================================================
// Query Hooks (Merged Layer: Synced + Local)
// ============================================================================

/**
 * Hook to get all edges (merged: synced + pending local changes)
 * Returns instant feedback with _local metadata for sync status
 * Auto-cleanup when Electric confirms sync
 */
export function useEdges() {
  const electricResult = edgesElectric.useEdges();

  // Sync Electric data to Dexie edges table (for merge layer)
  // CRITICAL: Must sync even when empty to clear stale data
  useEffect(() => {
    if (electricResult.data !== undefined) {
      syncElectricToDexie(electricResult.data).catch((error) => {
        if (error.name === "DatabaseClosedError") return;
        console.error(
          "[useEdges] Failed to sync Electric data to Dexie:",
          error
        );
      });
    }
  }, [electricResult.data]);

  // Query merged data from Dexie
  const mergedQuery = useQuery({
    queryKey: ["edges", "merged"],
    queryFn: async () => {
      return edgesMerged.getAllMergedEdges();
    },
    staleTime: 0, // Always check for local changes
    initialData: [], // Start with empty array to prevent loading state
  });

  // Auto-cleanup and refresh when Electric data changes (synced)
  useEffect(() => {
    if (electricResult.data) {
      edgesCleanup.cleanupSyncedEdges(electricResult.data).then(() => {
        mergedQuery.refetch();
      });
    }
  }, [electricResult.data]);

  return {
    ...mergedQuery,
    // Only show loading if merged query is loading (not Electric)
    // This allows instant feedback from Dexie cache
    isLoading: mergedQuery.isLoading,
  };
}

/**
 * Hook to get a single edge by ID (merged)
 */
export function useEdge(id: string | undefined) {
  const electricResult = edgesElectric.useEdge(id);

  const mergedQuery = useQuery({
    queryKey: ["edges", "merged", id],
    queryFn: async () => {
      if (!id) return undefined;
      return edgesMerged.getMergedEdge(id);
    },
    enabled: !!id,
    staleTime: 0,
  });

  useEffect(() => {
    if (electricResult.data && id) {
      mergedQuery.refetch();
    }
  }, [electricResult.data, id]);

  return mergedQuery;
}

/**
 * Hook to get edges from a specific entity (merged)
 */
export function useEdgesFrom(fromId: string | undefined) {
  const electricResult = edgesElectric.useEdgesFrom(fromId || "");

  const mergedQuery = useQuery({
    queryKey: ["edges", "merged", "from", fromId],
    queryFn: async () => {
      if (!fromId) return [];
      return edgesMerged.getMergedEdgesFrom(fromId);
    },
    enabled: !!fromId,
    staleTime: 0,
  });

  useEffect(() => {
    if (electricResult.data && fromId) {
      mergedQuery.refetch();
    }
  }, [electricResult.data, fromId]);

  if (!fromId) {
    return {
      data: [],
      isLoading: false,
      error: null,
    };
  }

  return mergedQuery;
}

/**
 * Hook to get edges to a specific entity (merged)
 */
export function useEdgesTo(toId: string | undefined) {
  const electricResult = edgesElectric.useEdgesTo(toId || "");

  const mergedQuery = useQuery({
    queryKey: ["edges", "merged", "to", toId],
    queryFn: async () => {
      if (!toId) return [];
      return edgesMerged.getMergedEdgesTo(toId);
    },
    enabled: !!toId,
    staleTime: 0,
  });

  useEffect(() => {
    if (electricResult.data && toId) {
      mergedQuery.refetch();
    }
  }, [electricResult.data, toId]);

  if (!toId) {
    return {
      data: [],
      isLoading: false,
      error: null,
    };
  }

  return mergedQuery;
}

/**
 * Hook to get edges by relation type (merged)
 */
export function useEdgesByRelation(fromId: string, relation: Relation) {
  const electricResult = edgesElectric.useEdgesByRelation(fromId, relation);

  const mergedQuery = useQuery({
    queryKey: ["edges", "merged", "relation", fromId, relation],
    queryFn: async () => {
      return edgesMerged.getMergedEdgesByRelation(fromId, relation);
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (electricResult.data) {
      mergedQuery.refetch();
    }
  }, [electricResult.data]);

  return mergedQuery;
}

// ============================================================================
// Mutation Hooks (Local Layer: Optimistic Writes)
// ============================================================================

// ============================================================================
// Mutation Hooks (Local Layer: Optimistic Writes)
// ============================================================================

/**
 * Hook to create a new edge (instant local write)
 * Writes to local Dexie immediately, syncs in background
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
      return edgesLocal.createEdgeLocal(fromId, toId, relation, {
        metadata,
        order,
      });
    },
    onSuccess: (newEdge: Edge) => {
      console.log(
        `✅ [useCreateEdge] Created edge ${newEdge.id} (${newEdge.relation}) (pending sync)`
      );
      // Invalidate merged queries to show new edge immediately
      queryClient.invalidateQueries({ queryKey: ["edges", "merged"] });
    },
    onError: (error: Error) => {
      console.error("❌ [useCreateEdge] Failed to create edge:", error);
    },
  });
}

/**
 * Hook to update an edge (instant local write)
 */
export function useUpdateEdge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Edge, "id" | "createdAt">>;
    }) => {
      await edgesLocal.updateEdgeLocal(id, updates);
      return { id, updates };
    },
    onSuccess: ({ id }: { id: string; updates: Partial<Edge> }) => {
      console.log(`✅ [useUpdateEdge] Updated edge ${id} (pending sync)`);
      // Invalidate merged queries
      queryClient.invalidateQueries({ queryKey: ["edges", "merged"] });
    },
    onError: (error: Error) => {
      console.error("❌ [useUpdateEdge] Failed to update edge:", error);
    },
  });
}

/**
 * Hook to delete an edge (instant local write)
 */
export function useDeleteEdge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await edgesLocal.deleteEdgeLocal(id);
      return id;
    },
    onSuccess: (id: string) => {
      console.log(`✅ [useDeleteEdge] Deleted edge ${id} (pending sync)`);
      // Invalidate merged queries to remove immediately
      queryClient.invalidateQueries({ queryKey: ["edges", "merged"] });
    },
    onError: (error: Error) => {
      console.error("❌ [useDeleteEdge] Failed to delete edge:", error);
    },
  });
}

/**
 * Hook to delete edges between two entities
 * Note: Deletes all edges between fromId and toId
 */
export function useDeleteEdgesBetween() {
  const queryClient = useQueryClient();
  const deleteEdge = useDeleteEdge();

  return useMutation({
    mutationFn: async ({ fromId, toId }: { fromId: string; toId: string }) => {
      // Get all edges between the entities
      const edges = await edgesMerged.getMergedEdgesFrom(fromId);
      const edgesToDelete = edges.filter((e) => e.toId === toId);

      // Delete each edge
      for (const edge of edgesToDelete) {
        await edgesLocal.deleteEdgeLocal(edge.id);
      }

      return { fromId, toId, deletedCount: edgesToDelete.length };
    },
    onSuccess: ({
      fromId,
      toId,
      deletedCount,
    }: {
      fromId: string;
      toId: string;
      deletedCount: number;
    }) => {
      console.log(
        `✅ [useDeleteEdgesBetween] Deleted ${deletedCount} edge(s) between ${fromId} and ${toId} (pending sync)`
      );
      // Invalidate merged queries
      queryClient.invalidateQueries({ queryKey: ["edges", "merged"] });
    },
    onError: (error: Error) => {
      console.error(
        "❌ [useDeleteEdgesBetween] Failed to delete edges between entities:",
        error
      );
    },
  });
}
