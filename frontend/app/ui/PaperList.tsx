// src/components/PaperList.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { fetchPapers, Paper } from '../api/papers';

// Import logger
import logger from '@/src/logger';

const PaperList: React.FC = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  logger.trace('Calling PaperList');

  useEffect(() => {
    const loadPapers = async () => {
      try {
        const data = await fetchPapers();
        setPapers(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    loadPapers();
  }, []);

  if (loading) return <div>Loading papers...</div>;
  if (error) return <div>Error loading papers: {error}</div>;

  // Log the json response
    logger.debug(papers);

  return (
    <div>
      <h2>Paper List</h2>
      <ul>
        {papers.map(paper => (
          <li key={paper.id}>
            {paper.attributes.title}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PaperList;
