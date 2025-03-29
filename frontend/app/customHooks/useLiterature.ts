import { useQuery } from '@tanstack/react-query';
import { fetchLiteratures } from '../api/literatureService';
import { LiteratureType, LITERATURE_TYPES } from '../helpers/literatureTypes';

export const useLiterature = () => {
  return useQuery({
    queryKey: ['literature'],
    queryFn: async () => {
      const literatures = await Promise.all(
        LITERATURE_TYPES.map((type: LiteratureType) => fetchLiteratures(type))
      );

      return literatures.reduce((acc, items, index) => {
        return { ...acc, [LITERATURE_TYPES[index]]: items };
      }, {} as Record<string, any>);
    },
  });
};
