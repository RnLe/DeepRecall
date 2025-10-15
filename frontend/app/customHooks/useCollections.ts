// useCollections.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  fetchCollections, 
  createCollection, 
  updateCollection, 
  deleteCollection,
  addLiteratureToCollection,
  removeLiteratureFromCollection
} from '../api/collectionService';
import { CollectionExtended, Collection } from '../types/deepRecall/strapi/collectionTypes';

export const useCollections = () => {
  return useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
    select: (data) => {
      // console.log("Fetched collections data:", data);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - collections don't change as frequently
  });
};

export const useCreateCollection = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (collectionData: Omit<CollectionExtended, "documentId" | "id" | "createdAt" | "updatedAt" | "publishedAt">) => 
      createCollection(collectionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
    onError: (error) => {
      console.error('Failed to create collection:', error);
    },
  });
};

export const useUpdateCollection = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CollectionExtended> }) => 
      updateCollection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
    onError: (error) => {
      console.error('Failed to update collection:', error);
    },
  });
};

export const useDeleteCollection = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
    onError: (error) => {
      console.error('Failed to delete collection:', error);
    },
  });
};

export const useAddLiteratureToCollection = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ collectionId, literatureId }: { collectionId: string; literatureId: string }) => 
      addLiteratureToCollection(collectionId, literatureId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      // Also invalidate literature queries in case they depend on collection data
      queryClient.invalidateQueries({ queryKey: ['literature'] });
    },
    onError: (error) => {
      console.error('Failed to add literature to collection:', error);
    },
  });
};

export const useRemoveLiteratureFromCollection = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ collectionId, literatureId }: { collectionId: string; literatureId: string }) => 
      removeLiteratureFromCollection(collectionId, literatureId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      // Also invalidate literature queries in case they depend on collection data
      queryClient.invalidateQueries({ queryKey: ['literature'] });
    },
    onError: (error) => {
      console.error('Failed to remove literature from collection:', error);
    },
  });
};
