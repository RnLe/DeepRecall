// useLiterature.ts
import { useQuery } from '@tanstack/react-query';
import { fetchLiteratures, fetchLiteratureTypes } from '../api/literatureService';

export const useLiterature = () => {
  return useQuery({
    queryKey: ['literature'],
    queryFn: fetchLiteratures,
    select: (data) => {
      return data;
    }
  });
};

// New hook to fetch literature types
export const useLiteratureTypes = () => {
  return useQuery({
    queryKey: ['literatureTypes'],
    queryFn: fetchLiteratureTypes,
    select: (data) => {
      return data;
    }
  });
};
