// useLiterature.ts
import { useQuery } from '@tanstack/react-query';
import { fetchLiteratures, fetchLiteratureTypes, fetchVersionTypes } from '../api/literatureService';

export const useLiterature = () => {
  return useQuery({
    queryKey: ['literature'],
    queryFn: fetchLiteratures,
    select: (data) => {
      // console.log("Fetched literature data:", data);
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
