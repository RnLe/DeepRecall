// Import API Token from .env file (in root directory)
require('dotenv').config()

// src/api/papers.ts
require('dotenv').config();

const API_TOKEN = process.env.API_TOKEN;

export interface Paper {
  id: number;
  attributes: {
    title: string;
    // weitere Felder entsprechend deiner API
  };
}

export interface PaperResponse {
  data: Paper[];
}

export const fetchPapers = async (): Promise<Paper[]> => {
  const response = await fetch('http://backend:1337/api/papers', {
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
