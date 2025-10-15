// useLiterature.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchLiteratures, fetchLiteratureTypes, fetchVersionTypes, enhanceLiteraturesWithFiles, updateLiterature } from '../../src/api/literatureService';

export const useLiterature = () => {
  return useQuery({
    queryKey: ['literature'],
    queryFn: () => fetchLiteratures(false), // Don't include files by default for performance
    select: (data) => {
      // console.log("Fetched literature data:", data);
      return data;
    },
    
  });
};

// Hook to fetch literature with enhanced file data
export const useLiteratureWithFiles = () => {
  return useQuery({
    queryKey: ['literature-with-files'],
    queryFn: () => fetchLiteratures(true), // Include full file data
    select: (data) => {
      // console.log("Fetched enhanced literature data:", data);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - cache longer since file data doesn't change often
  });
};

// Hook to enhance existing literature data with file information
export const useEnhanceLiteratureWithFiles = (literatures: any[]) => {
  return useQuery({
    queryKey: ['enhanced-literature', literatures.length],
    queryFn: () => enhanceLiteraturesWithFiles(literatures),
    enabled: literatures.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes - cache enhanced data to prevent flickering
    select: (data) => {
      // console.log("Enhanced literature data with files:", data);
      return data;
    },
  });
};

// New hook to fetch literature types
export const useLiteratureTypes = () => {
  return useQuery({
    queryKey: ['literatureTypes'],
    queryFn: fetchLiteratureTypes,
    select: (data) => {
      // console.log("Fetched literature types data:", data);
      return data;
    }
  });
};

// New hook to fetch version types.
export const useVersionTypes = () => {
  return useQuery({
    queryKey: ['versionTypes'],
    queryFn: fetchVersionTypes,
    select: (data) => {
      // console.log("Fetched version types data:", data);
      return data;
    }
  });
};

// Hook to update literature
export const useUpdateLiterature = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<any> }) => 
      updateLiterature(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['literature'] });
      queryClient.invalidateQueries({ queryKey: ['literature-with-files'] });
    },
    onError: (error) => {
      console.error('Failed to update literature:', error);
    },
  });
};
