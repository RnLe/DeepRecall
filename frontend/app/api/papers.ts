// src/api/papers.ts
// In client components, dotenv is not available. You can use the API token directly in the fetch call.
// require('dotenv').config();

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;

// Logger not compatible with server-side rendering

export interface Paper {
  id: number;
  attributes: {
    title: string;
    journal: string;
    doi: string;
  };
}

export interface PaperResponse {
  data: Paper[];
}

export const fetchPapers = async (): Promise<Paper[]> => {
  const response = await fetch('http://localhost:1337/api/papers', {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`
    }
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  const papers: PaperResponse = await response.json();
  return papers.data;
};
