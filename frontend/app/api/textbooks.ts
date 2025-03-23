// textbooks.ts
import { Textbook, TextbookVersionPayload } from "../helpers/mediaTypes";

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
const BASE_URL = "http://localhost:1337/api/textbooks";
const BASE_VERSION_URL = "http://localhost:1337/api/textbook-versions";

export interface TextbookResponse {
  data: Textbook[];
}

export const fetchTextbooks = async (): Promise<Textbook[]> => {
  const params = new URLSearchParams();
  params.append('populate[0]', 'textbook_versions');
  params.append('populate[1]', 'authors');
  params.append('populate[textbook_versions][populate]', '*');
  params.append('populate[authors][populate]', '*');

  const response = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorBody)}`);
  }

  const json: TextbookResponse = await response.json();
  console.log(json.data);
  return json.data;
};

/**
 * Creates a new textbook entry.
 * @param textbookData - Object with textbook fields (e.g., title, description, isbn, doi)
 * @returns The created textbook entry.
 */
export const createTextbook = async (
  textbookData: Omit<Textbook, "id">
): Promise<Textbook> => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({ data: textbookData }),
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
 * Creates a new textbook version entry linked to an existing textbook.
 * @param versionData - Object with textbook version fields, including textbook_id.
 * @returns The created textbook version entry.
 */
export const createTextbookVersion = async (
  versionData: Omit<TextbookVersionPayload, "id">
): Promise<TextbookVersionPayload> => {
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
