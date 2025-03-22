import { useQuery } from '@tanstack/react-query';
import { fetchPapers } from '../api/papers';
import { fetchTextbooks } from '../api/textbooks';
import { fetchScripts } from '../api/scripts';

export const useLiterature = () => {
  return useQuery({
    queryKey: ['literature'], // Correctly specify the query key
    queryFn: async () => {
      const [papers, textbooks, scripts] = await Promise.all([
        fetchPapers(),
        fetchTextbooks(),
        fetchScripts(),
      ]);
      return { papers, textbooks, scripts };
    },
  });
};
