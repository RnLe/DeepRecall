// papers.ts
import { Paper, PaperVersionPayload } from "../helpers/mediaTypes";

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
const BASE_URL = "http://localhost:1337/api/papers";
const BASE_VERSION_URL = "http://localhost:1337/api/paper-versions";

export interface PaperResponse {
  data: Paper[];
}

// Fetch Papers including Versions + Authors
export const fetchPapers = async (): Promise<Paper[]> => {
  const params = new URLSearchParams();
  params.append('populate[0]', 'paper_versions');
  params.append('populate[1]', 'authors');
  params.append('populate[paper_versions][populate]', '*');
  params.append('populate[authors][populate]', '*');

  const response = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorBody)}`);
  }

  const json: PaperResponse = await response.json();
  console.log(json.data);
  return json.data;
};

/**
 * Creates a new paper entry.
 * @param paperData - Object with paper fields (e.g., title, journal, doi)
 * @returns The created paper entry.
 */
export const createPaper = async (
  paperData: Omit<Paper, "id">
): Promise<Paper> => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({ data: paperData }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorBody)}`);
  }
  const json = await response.json();
  return json.data;
};

/**
 * Creates a new paper version entry linked to an existing paper.
 * @param versionData - Object with paper version fields, including the related paper_id.
 * @returns The created paper version entry.
 */
export const createPaperVersion = async (
  versionData: Omit<PaperVersionPayload, "id">
): Promise<PaperVersionPayload> => {
  const response = await fetch(BASE_VERSION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({ data: versionData }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorBody)}`);
  }
  const json = await response.json();
  return json.data;
};
