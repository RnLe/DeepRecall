// authors.ts

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
const BASE_URL = "http://localhost:1337/api/authors";

export interface Author {
  id: number;
  first_name: string;
  last_name: string;
  orcid?: string;
}

/**
 * Creates a new author entry in the database.
 * @param authorData - Object containing first_name, last_name and optionally orcid.
 * @returns The created Author entry.
 */
export const createAuthor = async (
  authorData: Omit<Author, "id">
): Promise<Author> => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({ data: authorData }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorBody)}`);
  }

  const json = await response.json();
  return json.data;
};
