/**
 * React Query hooks for library entities
 * Following mental model: React Query for async operations + cache
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import type {
  Work,
  Asset,
  Activity,
  Collection,
  WorkExtended,
  AssetExtended,
  ActivityExtended,
  CollectionExtended,
} from "@deeprecall/core/schemas/library";
import * as workRepo from "@deeprecall/data/repos/works";
import * as assetRepo from "@deeprecall/data/repos/assets";
import * as activityRepo from "@deeprecall/data/repos/activities";
import * as collectionRepo from "@deeprecall/data/repos/collections";
import * as edgeRepo from "@deeprecall/data/repos/edges";

// ============================================================================
// Works
// ============================================================================

/**
 * Hook to get all works (live query)
 */
export function useWorks() {
  return useLiveQuery(() => workRepo.listWorks(), []);
}

/**
 * Hook to get all works with extended data (versions + assets) (live query)
 */
export function useWorksExtended() {
  return useLiveQuery(async () => {
    try {
      const result = await workRepo.listWorksExtended();
      return result;
    } catch (error) {
      console.error("useWorksExtended: Error fetching works:", error);
      return [];
    }
  }, []);
}

/**
 * Hook to get a single work (live query)
 */
export function useWork(id: string | undefined) {
  return useLiveQuery(() => (id ? workRepo.getWork(id) : undefined), [id]);
}

/**
 * Hook to get a single work with extended data (live query)
 */
export function useWorkExtended(id: string | undefined) {
  return useLiveQuery(
    () => (id ? workRepo.getWorkExtended(id) : undefined),
    [id]
  );
}

/**
 * Hook to search works by title (live query)
 */
export function useSearchWorks(query: string) {
  return useLiveQuery(() => workRepo.searchWorksByTitle(query), [query]);
}

/**
 * Hook to get works by type (live query)
 */
export function useWorksByType(workType: string) {
  return useLiveQuery(() => workRepo.listWorksByType(workType), [workType]);
}

/**
 * Hook to get favorite works (live query)
 */
export function useFavoriteWorks() {
  return useLiveQuery(() => workRepo.listFavoriteWorks(), []);
}

/**
 * Mutation to create a work
 */
export function useCreateWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Work, "id" | "createdAt" | "updatedAt">) =>
      workRepo.createWork(data),
    onSuccess: () => {
      // Invalidate works queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["works"] });
    },
  });
}

/**
 * Mutation to create a work with its first asset
 * Used when linking a blob to a new work
 */
export function useCreateWorkWithAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: workRepo.createWorkWithAsset,
    onSuccess: () => {
      // Invalidate both works and orphaned blobs queries
      queryClient.invalidateQueries({ queryKey: ["works"] });
      queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
      queryClient.invalidateQueries({ queryKey: ["blobs"] });
    },
  });
}

/**
 * @deprecated Use useCreateWorkWithAsset instead
 */
export const useCreateWorkWithVersionAndAsset = useCreateWorkWithAsset;

/**
 * Mutation to update a work
 */
export function useUpdateWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Work, "id" | "kind" | "createdAt">>;
    }) => workRepo.updateWork(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["works"] });
    },
  });
}

/**
 * Mutation to delete a work
 */
export function useDeleteWork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workRepo.deleteWork(id),
    onSuccess: () => {
      // Invalidate works, blobs, and orphaned blobs (since deleted assets become orphaned)
      queryClient.invalidateQueries({ queryKey: ["works"] });
      queryClient.invalidateQueries({ queryKey: ["orphanedBlobs"] });
      queryClient.invalidateQueries({ queryKey: ["blobs"] });
    },
  });
}

/**
 * Mutation to toggle work favorite
 */
export function useToggleWorkFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workRepo.toggleWorkFavorite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["works"] });
    },
  });
}

// ============================================================================
// Versions
// ============================================================================

// ============================================================================
// Assets
// ============================================================================

/**
 * Hook to get assets for a work (live query)
 */
export function useAssetsForWork(workId: string | undefined) {
  return useLiveQuery(
    () => (workId ? assetRepo.listAssetsForWork(workId) : []),
    [workId]
  );
}

/**
 * Hook to get a single asset (live query)
 */
export function useAsset(id: string | undefined) {
  return useLiveQuery(() => (id ? assetRepo.getAsset(id) : undefined), [id]);
}

/**
 * Hook to get a single asset with extended data (live query)
 */
export function useAssetExtended(id: string | undefined) {
  return useLiveQuery(
    () => (id ? assetRepo.getAssetExtended(id) : undefined),
    [id]
  );
}

/**
 * Hook to get an asset by hash (live query)
 */
export function useAssetByHash(sha256: string | undefined) {
  return useLiveQuery(
    () => (sha256 ? assetRepo.getAssetByHash(sha256) : undefined),
    [sha256]
  );
}

/**
 * Hook to search assets by filename (live query)
 */
export function useSearchAssets(query: string) {
  return useLiveQuery(() => assetRepo.searchAssetsByFilename(query), [query]);
}

/**
 * Mutation to create an asset
 */
export function useCreateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Asset, "id" | "createdAt" | "updatedAt">) =>
      assetRepo.createAsset(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

/**
 * Mutation to update an asset
 */
export function useUpdateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<
        Omit<Asset, "id" | "kind" | "versionId" | "sha256" | "createdAt">
      >;
    }) => assetRepo.updateAsset(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

/**
 * Mutation to delete an asset
 */
export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => assetRepo.deleteAsset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

// ============================================================================
// Activities
// ============================================================================

/**
 * Hook to get all activities (live query)
 */
export function useActivities() {
  return useLiveQuery(() => activityRepo.listActivities(), []);
}

/**
 * Hook to get a single activity (live query)
 */
export function useActivity(id: string | undefined) {
  return useLiveQuery(
    () => (id ? activityRepo.getActivity(id) : undefined),
    [id]
  );
}

/**
 * Hook to get a single activity with extended data (live query)
 */
export function useActivityExtended(id: string | undefined) {
  return useLiveQuery(
    () => (id ? activityRepo.getActivityExtended(id) : undefined),
    [id]
  );
}

/**
 * Hook to get activities by type (live query)
 */
export function useActivitiesByType(activityType: string) {
  return useLiveQuery(
    () => activityRepo.listActivitiesByType(activityType),
    [activityType]
  );
}

/**
 * Hook to search activities by title (live query)
 */
export function useSearchActivities(query: string) {
  return useLiveQuery(
    () => activityRepo.searchActivitiesByTitle(query),
    [query]
  );
}

/**
 * Hook to get active activities (live query)
 */
export function useActiveActivities() {
  return useLiveQuery(() => activityRepo.listActiveActivities(), []);
}

/**
 * Hook to get upcoming activities (live query)
 */
export function useUpcomingActivities() {
  return useLiveQuery(() => activityRepo.listUpcomingActivities(), []);
}

/**
 * Mutation to create an activity
 */
export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Activity, "id" | "createdAt" | "updatedAt">) =>
      activityRepo.createActivity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

/**
 * Mutation to update an activity
 */
export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Activity, "id" | "kind" | "createdAt">>;
    }) => activityRepo.updateActivity(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

/**
 * Mutation to delete an activity
 */
export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => activityRepo.deleteActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

// ============================================================================
// Collections
// ============================================================================

/**
 * Hook to get all collections (live query)
 */
export function useCollections() {
  return useLiveQuery(() => collectionRepo.listCollections(), []);
}

/**
 * Hook to get a single collection (live query)
 */
export function useCollection(id: string | undefined) {
  return useLiveQuery(
    () => (id ? collectionRepo.getCollection(id) : undefined),
    [id]
  );
}

/**
 * Hook to get a single collection with extended data (live query)
 */
export function useCollectionExtended(id: string | undefined) {
  return useLiveQuery(
    () => (id ? collectionRepo.getCollectionExtended(id) : undefined),
    [id]
  );
}

/**
 * Hook to search collections by name (live query)
 */
export function useSearchCollections(query: string) {
  return useLiveQuery(
    () => collectionRepo.searchCollectionsByName(query),
    [query]
  );
}

/**
 * Hook to get public collections (live query)
 */
export function usePublicCollections() {
  return useLiveQuery(() => collectionRepo.listPublicCollections(), []);
}

/**
 * Mutation to create a collection
 */
export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Collection, "id" | "createdAt" | "updatedAt">) =>
      collectionRepo.createCollection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

/**
 * Mutation to update a collection
 */
export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<Collection, "id" | "kind" | "createdAt">>;
    }) => collectionRepo.updateCollection(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

/**
 * Mutation to delete a collection
 */
export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => collectionRepo.deleteCollection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

// ============================================================================
// Edges
// ============================================================================

/**
 * Hook to get outgoing edges from an entity (live query)
 */
export function useOutgoingEdges(fromId: string | undefined) {
  return useLiveQuery(
    () => (fromId ? edgeRepo.getOutgoingEdges(fromId) : []),
    [fromId]
  );
}

/**
 * Hook to get incoming edges to an entity (live query)
 */
export function useIncomingEdges(toId: string | undefined) {
  return useLiveQuery(
    () => (toId ? edgeRepo.getIncomingEdges(toId) : []),
    [toId]
  );
}

/**
 * Hook to get collections for an entity (live query)
 */
export function useCollectionsForEntity(entityId: string | undefined) {
  return useLiveQuery(
    () => (entityId ? edgeRepo.getCollectionsForEntity(entityId) : []),
    [entityId]
  );
}

/**
 * Mutation to create an edge
 */
export function useCreateEdge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: Parameters<typeof edgeRepo.createEdge>) =>
      edgeRepo.createEdge(...params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["edges"] });
    },
  });
}

/**
 * Mutation to delete an edge
 */
export function useDeleteEdge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => edgeRepo.deleteEdge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["edges"] });
    },
  });
}

/**
 * Mutation to add entity to collection
 */
export function useAddToCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      collectionId,
      entityId,
      order,
    }: {
      collectionId: string;
      entityId: string;
      order?: number;
    }) => edgeRepo.addToCollection(collectionId, entityId, order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["edges"] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

/**
 * Mutation to remove entity from collection
 */
export function useRemoveFromCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      collectionId,
      entityId,
    }: {
      collectionId: string;
      entityId: string;
    }) => edgeRepo.removeFromCollection(collectionId, entityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["edges"] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

// ============================================================================
// Preset Usage Tracking
// ============================================================================

/**
 * Hook to count how many entities use a specific preset
 */
export function usePresetUsageCount(presetId: string | undefined) {
  return useLiveQuery(async () => {
    if (!presetId) return { works: 0, assets: 0, total: 0 };

    const db = (await import("@deeprecall/data/db")).db;

    const [works, assets] = await Promise.all([
      db.works.where("presetId").equals(presetId).count(),
      db.assets.where("presetId").equals(presetId).count(),
    ]);

    return {
      works,
      assets,
      total: works + assets,
    };
  }, [presetId]);
}
