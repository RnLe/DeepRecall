/**
 * AuthorInput Component (Next.js wrapper)
 *
 * Smart author selection/creation with:
 * - Autocomplete search for existing authors
 * - Inline creation of new authors
 * - Smart name parsing with auto-capitalization
 * - ORCID support
 * - Multi-author management with ordering
 */

"use client";

import {
  AuthorInput as AuthorInputUI,
  type AuthorOperations,
} from "@deeprecall/ui";
import { parseAuthorList, formatAuthorName } from "@/src/utils/nameParser";
import { getAuthorFullName, type Author } from "@deeprecall/core";
import {
  createAuthor as createAuthorElectric,
  useAuthors,
} from "@deeprecall/data/repos/authors.electric";
import { queryShape } from "@deeprecall/data/electric";

interface AuthorInputProps {
  value: string[]; // Array of author IDs
  authors: Author[]; // Full author objects (from useAuthorsByIds)
  onChange: (authorIds: string[]) => void;
  placeholder?: string;
  className?: string;
}

// Search authors using Electric
async function searchAuthors(query: string): Promise<Author[]> {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const allAuthors = await queryShape<Author>({ table: "authors" });

  // Filter and sort results
  const filtered = allAuthors.filter((author) => {
    const fullName = getAuthorFullName(author).toLowerCase();
    const firstName = author.firstName.toLowerCase();
    const lastName = author.lastName.toLowerCase();

    return (
      fullName.includes(lowerQuery) ||
      firstName.includes(lowerQuery) ||
      lastName.includes(lowerQuery) ||
      author.orcid?.toLowerCase().includes(lowerQuery)
    );
  });

  // Sort by relevance
  return filtered
    .sort((a, b) => {
      const aLastName = a.lastName.toLowerCase();
      const bLastName = b.lastName.toLowerCase();
      const aFirstName = a.firstName.toLowerCase();
      const bFirstName = b.firstName.toLowerCase();

      // Prioritize exact matches
      if (aLastName === lowerQuery) return -1;
      if (bLastName === lowerQuery) return 1;
      if (aFirstName === lowerQuery) return -1;
      if (bFirstName === lowerQuery) return 1;

      // Then prioritize starts-with
      if (aLastName.startsWith(lowerQuery) && !bLastName.startsWith(lowerQuery))
        return -1;
      if (bLastName.startsWith(lowerQuery) && !aLastName.startsWith(lowerQuery))
        return 1;

      // Finally alphabetical
      return aLastName.localeCompare(bLastName);
    })
    .slice(0, 10); // Limit to 10 results
}

// Find or create author using Electric
async function findOrCreateAuthor(data: {
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
    const existingByOrcid = await queryShape<Author>({
      table: "authors",
      where: `orcid = '${data.orcid.replace(/'/g, "''")}'`,
    });

    if (existingByOrcid.length > 0) {
      return existingByOrcid[0];
    }
  }

  // Try to find by exact name match (case-insensitive)
  const allAuthors = await queryShape<Author>({ table: "authors" });
  const firstName = data.firstName.toLowerCase();
  const lastName = data.lastName.toLowerCase();
  const middleName = data.middleName?.toLowerCase() || "";

  const existing = allAuthors.find((author) => {
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
    return existing;
  }

  // Create new author
  return createAuthorElectric({
    firstName: data.firstName,
    lastName: data.lastName,
    middleName: data.middleName,
    titles: data.title ? [data.title] : undefined,
    affiliation: data.affiliation,
    orcid: data.orcid,
    contact: data.contact,
    website: data.website,
    bio: data.bio,
  });
}

// Next.js implementation of author operations
const authorOps: AuthorOperations = {
  searchAuthors,
  findOrCreateAuthor,
  getAuthorFullName,
  parseAuthorList,
  formatAuthorName,
};

// Export factory function for creating author operations
export function createAuthorOperations(): AuthorOperations {
  return authorOps;
}

export function AuthorInput(props: AuthorInputProps) {
  return <AuthorInputUI {...props} authorOps={authorOps} />;
}
