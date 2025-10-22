/**
 * Author Repository
 *
 * Provides CRUD operations for Author entities in Dexie (IndexedDB).
 * Handles author creation, search, deduplication, and relationship management.
 */

import { db } from "@deeprecall/data/db";
import type { Author } from "@deeprecall/core";
import { v4 as uuidv4 } from "uuid";

/**
 * Create a new author in the database
 */
export async function createAuthor(
  data: Omit<Author, "id" | "kind" | "createdAt" | "updatedAt">
): Promise<Author> {
  const now = new Date().toISOString();

  const author: Author = {
    id: uuidv4(),
    kind: "author",
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  await db.authors.add(author);
  return author;
}

/**
 * Get a single author by ID
 */
export async function getAuthor(id: string): Promise<Author | undefined> {
  return db.authors.get(id);
}

/**
 * Get multiple authors by IDs
 */
export async function getAuthors(ids: string[]): Promise<Author[]> {
  return db.authors.where("id").anyOf(ids).toArray();
}

/**
 * List all authors, optionally sorted
 */
export async function listAuthors(options?: {
  sortBy?: "lastName" | "firstName" | "createdAt";
  reverse?: boolean;
  limit?: number;
}): Promise<Author[]> {
  let collection = db.authors.toCollection();

  if (options?.sortBy) {
    collection = db.authors.orderBy(options.sortBy);
  }

  if (options?.reverse) {
    collection = collection.reverse();
  }

  if (options?.limit) {
    collection = collection.limit(options.limit);
  }

  return collection.toArray();
}

/**
 * Search authors by name (case-insensitive, partial matching)
 */
export async function searchAuthors(
  query: string,
  options?: { limit?: number }
): Promise<Author[]> {
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) {
    return listAuthors({ limit: options?.limit || 20 });
  }

  // Search by first name, last name, or full name
  const authors = await db.authors.toArray();

  const matches = authors.filter((author) => {
    const firstName = author.firstName.toLowerCase();
    const lastName = author.lastName.toLowerCase();
    const middleName = author.middleName?.toLowerCase() || "";
    const fullName = `${firstName} ${middleName} ${lastName}`.trim();

    return (
      firstName.includes(lowerQuery) ||
      lastName.includes(lowerQuery) ||
      middleName.includes(lowerQuery) ||
      fullName.includes(lowerQuery)
    );
  });

  // Sort by relevance: exact matches first, then starts-with, then contains
  matches.sort((a, b) => {
    const aFirstName = a.firstName.toLowerCase();
    const aLastName = a.lastName.toLowerCase();
    const bFirstName = b.firstName.toLowerCase();
    const bLastName = b.lastName.toLowerCase();

    // Exact match on last name
    if (aLastName === lowerQuery) return -1;
    if (bLastName === lowerQuery) return 1;

    // Exact match on first name
    if (aFirstName === lowerQuery) return -1;
    if (bFirstName === lowerQuery) return 1;

    // Starts with on last name
    if (aLastName.startsWith(lowerQuery) && !bLastName.startsWith(lowerQuery))
      return -1;
    if (bLastName.startsWith(lowerQuery) && !aLastName.startsWith(lowerQuery))
      return 1;

    // Starts with on first name
    if (aFirstName.startsWith(lowerQuery) && !bFirstName.startsWith(lowerQuery))
      return -1;
    if (bFirstName.startsWith(lowerQuery) && !aFirstName.startsWith(lowerQuery))
      return 1;

    // Alphabetical by last name
    return aLastName.localeCompare(bLastName);
  });

  return options?.limit ? matches.slice(0, options.limit) : matches;
}

/**
 * Search authors by ORCID (exact match)
 */
export async function searchAuthorsByOrcid(orcid: string): Promise<Author[]> {
  return db.authors.where("orcid").equals(orcid).toArray();
}

/**
 * Update an existing author
 */
export async function updateAuthor(
  id: string,
  updates: Partial<Omit<Author, "id" | "kind" | "createdAt">>
): Promise<void> {
  const now = new Date().toISOString();

  await db.authors.update(id, {
    ...updates,
    updatedAt: now,
  });
}

/**
 * Delete an author (use with caution - will leave orphaned authorIds in Works)
 */
export async function deleteAuthor(id: string): Promise<void> {
  await db.authors.delete(id);
}

/**
 * Find or create an author based on name and optional ORCID
 * This is useful for deduplication when importing from BibTeX or other sources
 */
export async function findOrCreateAuthor(data: {
  firstName: string;
  lastName: string;
  middleName?: string;
  title?: string;
  affiliation?: string;
  orcid?: string;
  contact?: string;
  website?: string;
  bio?: string;
}): Promise<Author> {
  // Try to find by ORCID first (most reliable)
  if (data.orcid) {
    const existingByOrcid = await db.authors
      .where("orcid")
      .equals(data.orcid)
      .first();

    if (existingByOrcid) {
      // Update with new information if provided
      if (data.affiliation || data.contact || data.website || data.bio) {
        await updateAuthor(existingByOrcid.id, {
          affiliation: data.affiliation || existingByOrcid.affiliation,
          contact: data.contact || existingByOrcid.contact,
          website: data.website || existingByOrcid.website,
          bio: data.bio || existingByOrcid.bio,
        });
      }
      return getAuthor(existingByOrcid.id) as Promise<Author>;
    }
  }

  // Try to find by exact name match (case-insensitive)
  const firstName = data.firstName.toLowerCase();
  const lastName = data.lastName.toLowerCase();
  const middleName = data.middleName?.toLowerCase() || "";

  const authors = await db.authors.toArray();

  const existing = authors.find((author) => {
    const aFirstName = author.firstName.toLowerCase();
    const aLastName = author.lastName.toLowerCase();
    const aMiddleName = author.middleName?.toLowerCase() || "";

    return (
      aFirstName === firstName &&
      aLastName === lastName &&
      aMiddleName === middleName
    );
  });

  if (existing) {
    // Update with new information if provided
    if (
      data.orcid ||
      data.affiliation ||
      data.contact ||
      data.website ||
      data.bio ||
      data.title
    ) {
      await updateAuthor(existing.id, {
        orcid: data.orcid || existing.orcid,
        affiliation: data.affiliation || existing.affiliation,
        contact: data.contact || existing.contact,
        website: data.website || existing.website,
        bio: data.bio || existing.bio,
        titles: data.title ? [data.title] : existing.titles,
      });
    }
    return getAuthor(existing.id) as Promise<Author>;
  }

  // Create new author
  return createAuthor(data);
}

/**
 * Get all works that reference a specific author
 */
export async function getWorksForAuthor(authorId: string): Promise<string[]> {
  const works = await db.works.where("authorIds").equals(authorId).toArray();
  return works.map((work) => work.id);
}

/**
 * Batch create authors (useful for imports)
 */
export async function createAuthors(
  authorsData: Array<Omit<Author, "id" | "kind" | "createdAt" | "updatedAt">>
): Promise<Author[]> {
  const now = new Date().toISOString();

  const authors: Author[] = authorsData.map((data) => ({
    id: uuidv4(),
    kind: "author",
    ...data,
    createdAt: now,
    updatedAt: now,
  }));

  await db.authors.bulkAdd(authors);
  return authors;
}

/**
 * Get author statistics (number of works, etc.)
 */
export async function getAuthorStats(authorId: string): Promise<{
  workCount: number;
  coAuthors: Author[];
}> {
  // Get all works by this author
  const works = await db.works
    .filter((work) => work.authorIds?.includes(authorId))
    .toArray();

  const workCount = works.length;

  // Get all co-authors (authors who appear in the same works)
  const coAuthorIds = new Set<string>();

  for (const work of works) {
    work.authorIds?.forEach((id) => {
      if (id !== authorId) {
        coAuthorIds.add(id);
      }
    });
  }

  const coAuthors = await getAuthors(Array.from(coAuthorIds));

  return {
    workCount,
    coAuthors,
  };
}
