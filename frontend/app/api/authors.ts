// authors.ts

import { Author } from "../helpers/literatureTypesLegacy";

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
const BASE_URL = "http://localhost:1337/api/authors";

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
    throw new Error(
      `API Error: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }

  const json = await response.json();
  return json.data;
};

/**
 * Searches for authors whose first or last name contains the query (case-insensitive).
 * Uses Strapi 5 query syntax.
 *
 * @param query - The search string entered by the user.
 * @returns A promise resolving to an array of Author objects.
 */
export const searchAuthors = async (query: string): Promise<Author[]> => {
  if (!query || query.trim() === "") {
    return [];
  }
  
  // Construct the URL with filters for both first_name and last_name
  const url = `${BASE_URL}?filters[$or][0][first_name][$containsi]=${encodeURIComponent(
    query
  )}&filters[$or][1][last_name][$containsi]=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(
      `API Error: ${response.status} - ${JSON.stringify(errorBody)}`
    );
  }

  const json = await response.json();
  if (!json.data) return [];

  console.log(json.data);

  // Map the Strapi response to the Author interface.
  return json.data.map((item: any) => ({
    id: item.id,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    first_name: item.first_name,
    last_name: item.last_name,
    orcid: item.orcid,
  }));
};

/**
 * A simple debounce utility function.
 * It delays the execution of the provided function until after a specified delay.
 *
 * @param fn - The function to debounce.
 * @param delay - The delay in milliseconds.
 * @returns A debounced version of the function.
 */
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) =>
    new Promise((resolve, reject) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const result = await fn(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
}

/**
 * Export a debounced version of searchAuthors to reduce API traffic.
 * This function delays the API call until the user has stopped typing for 300ms.
 */
export const debouncedSearchAuthors = debounce(searchAuthors, 300);
