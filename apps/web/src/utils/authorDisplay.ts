/**
 * Author Display Utilities
 *
 * Helper functions for displaying authors in Work cards and other UI components
 */

import {
  getAuthorFullName,
  getAuthorCitationName,
  type Author,
} from "@deeprecall/core/schemas/library";

/**
 * Format authors for display in cards/lists
 */
export function formatAuthorsForDisplay(
  authors: Author[],
  options: {
    maxDisplay?: number;
    format?: "full" | "citation";
    separator?: string;
  } = {}
): string {
  const { maxDisplay = 3, format = "full", separator = ", " } = options;

  if (authors.length === 0) return "No authors";

  const displayAuthors = authors.slice(0, maxDisplay);

  const formatted = displayAuthors.map((author) =>
    format === "citation"
      ? getAuthorCitationName(author)
      : getAuthorFullName(author)
  );

  let result = formatted.join(separator);

  if (authors.length > maxDisplay) {
    result += ` et al.`;
  }

  return result;
}

/**
 * Format a single author for display with optional metadata
 */
export function formatAuthorWithMetadata(
  author: Author,
  options: {
    showAffiliation?: boolean;
    showOrcid?: boolean;
  } = {}
): string {
  const { showAffiliation = false, showOrcid = false } = options;

  let result = getAuthorFullName(author);

  const metadata: string[] = [];

  if (showAffiliation && author.affiliation) {
    metadata.push(author.affiliation);
  }

  if (showOrcid && author.orcid) {
    metadata.push(`ORCID: ${author.orcid}`);
  }

  if (metadata.length > 0) {
    result += ` (${metadata.join(", ")})`;
  }

  return result;
}

/**
 * Get author initials for avatars
 */
export function getAuthorInitials(author: Author): string {
  const first = author.firstName.charAt(0).toUpperCase();
  const last = author.lastName.charAt(0).toUpperCase();
  return `${first}${last}`;
}

/**
 * Sort authors by last name
 */
export function sortAuthorsByName(
  authors: Author[],
  reverse = false
): Author[] {
  const sorted = [...authors].sort((a, b) => {
    const comparison = a.lastName.localeCompare(b.lastName);
    if (comparison === 0) {
      return a.firstName.localeCompare(b.firstName);
    }
    return comparison;
  });

  return reverse ? sorted.reverse() : sorted;
}

/**
 * Group authors by affiliation
 */
export function groupAuthorsByAffiliation(
  authors: Author[]
): Map<string, Author[]> {
  const groups = new Map<string, Author[]>();

  authors.forEach((author) => {
    const affiliation = author.affiliation || "Unknown";
    if (!groups.has(affiliation)) {
      groups.set(affiliation, []);
    }
    groups.get(affiliation)!.push(author);
  });

  return groups;
}

/**
 * Format authors for citation (APA style)
 */
export function formatAuthorsAPA(authors: Author[]): string {
  if (authors.length === 0) return "";

  if (authors.length === 1) {
    const author = authors[0];
    return `${author.lastName}, ${author.firstName.charAt(0)}.`;
  }

  if (authors.length === 2) {
    const [a1, a2] = authors;
    return `${a1.lastName}, ${a1.firstName.charAt(0)}., & ${a2.lastName}, ${a2.firstName.charAt(0)}.`;
  }

  // 3+ authors
  const formatted = authors
    .slice(0, 20) // APA shows up to 20 authors
    .map((a) => `${a.lastName}, ${a.firstName.charAt(0)}.`)
    .join(", ");

  if (authors.length > 20) {
    return (
      formatted + ", ... " + getAuthorCitationName(authors[authors.length - 1])
    );
  }

  // Replace last comma with &
  const lastComma = formatted.lastIndexOf(", ");
  return (
    formatted.substring(0, lastComma) +
    ", &" +
    formatted.substring(lastComma + 1)
  );
}

/**
 * Format authors for citation (MLA style)
 */
export function formatAuthorsMLA(authors: Author[]): string {
  if (authors.length === 0) return "";

  if (authors.length === 1) {
    const author = authors[0];
    return `${author.lastName}, ${author.firstName}`;
  }

  if (authors.length === 2) {
    const [a1, a2] = authors;
    return `${a1.lastName}, ${a1.firstName}, and ${a2.firstName} ${a2.lastName}`;
  }

  // 3+ authors
  const first = authors[0];
  return `${first.lastName}, ${first.firstName}, et al.`;
}

/**
 * Format authors for citation (Chicago style)
 */
export function formatAuthorsChicago(authors: Author[]): string {
  if (authors.length === 0) return "";

  if (authors.length === 1) {
    const author = authors[0];
    return `${author.lastName}, ${author.firstName}`;
  }

  if (authors.length <= 3) {
    const formatted = authors.map((a, i) => {
      if (i === 0) {
        return `${a.lastName}, ${a.firstName}`;
      }
      return `${a.firstName} ${a.lastName}`;
    });

    if (authors.length === 2) {
      return formatted.join(" and ");
    }

    return (
      formatted.slice(0, -1).join(", ") +
      ", and " +
      formatted[formatted.length - 1]
    );
  }

  // 4+ authors
  const first = authors[0];
  return `${first.lastName}, ${first.firstName}, et al.`;
}

/**
 * Create a tooltip text for an author with all metadata
 */
export function getAuthorTooltip(author: Author): string {
  const lines: string[] = [getAuthorFullName(author)];

  if (author.title) {
    lines[0] = `${author.title} ${lines[0]}`;
  }

  if (author.affiliation) {
    lines.push(author.affiliation);
  }

  if (author.orcid) {
    lines.push(`ORCID: ${author.orcid}`);
  }

  if (author.contact) {
    lines.push(author.contact);
  }

  if (author.website) {
    lines.push(author.website);
  }

  return lines.join("\n");
}
