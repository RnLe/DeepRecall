import { useQuery } from '@tanstack/react-query';
import { fetchLiteratures } from '../api/literatureService';
import { LiteratureType } from '../helpers/literatureTypes';

// Updated custom hook that fetches literature for each type concurrently.
// Each call to fetchLiteratures (when provided a type) returns a flat array of literature items.
export const useLiterature = () => {
  return useQuery({
    queryKey: ['literature'],
    queryFn: async () => {
      // Fetch each literature type concurrently
      const [papers, textbooks, scripts, theses] = await Promise.all([
        fetchLiteratures('Paper' as LiteratureType),
        fetchLiteratures('Textbook' as LiteratureType),
        fetchLiteratures('Script' as LiteratureType),
        fetchLiteratures('Thesis' as LiteratureType),
      ]);
      // Return an object with each type's literature array.
      return { papers, textbooks, scripts, theses };
    },
  });
};
