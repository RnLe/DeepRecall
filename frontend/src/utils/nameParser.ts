/**
 * Smart Name Parsing Utilities
 *
 * Handles parsing of author names in various formats:
 * - "Last, First" (BibTeX format)
 * - "First Last" (natural format)
 * - "Last, First and Last2, First2" (multiple authors)
 * - Automatic capitalization
 * - ORCID extraction from parentheses
 */

/**
 * Capitalize a name component properly
 * Handles special cases like "von", "de", "van der", etc.
 */
export function capitalizeName(name: string): string {
  if (!name) return "";

  const lowerName = name.toLowerCase().trim();

  // Special particles that should stay lowercase (unless at start)
  const particles = [
    "von",
    "van",
    "de",
    "del",
    "della",
    "di",
    "da",
    "dos",
    "das",
    "le",
    "la",
  ];

  const words = lowerName.split(/\s+/);

  return words
    .map((word, index) => {
      // Empty word
      if (!word) return "";

      // Check if it's a particle (and not at the start)
      if (index > 0 && particles.includes(word)) {
        return word;
      }

      // Handle hyphenated names (e.g., "Jean-Pierre")
      if (word.includes("-")) {
        return word
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join("-");
      }

      // Standard capitalization
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Parse a single author name in various formats
 */
export interface ParsedAuthor {
  firstName: string;
  lastName: string;
  middleName?: string;
  orcid?: string;
}

export function parseAuthorName(input: string): ParsedAuthor {
  let name = input.trim();
  let orcid: string | undefined;

  // Extract ORCID if present in parentheses
  const orcidMatch = name.match(
    /\(([0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X])\)/
  );
  if (orcidMatch) {
    orcid = orcidMatch[1];
    name = name.replace(orcidMatch[0], "").trim();
  }

  // Remove extra whitespace
  name = name.replace(/\s+/g, " ").trim();

  let firstName = "";
  let lastName = "";
  let middleName: string | undefined;

  // Format 1: "Last, First Middle" (BibTeX format)
  if (name.includes(",")) {
    const parts = name.split(",").map((s) => s.trim());
    lastName = capitalizeName(parts[0]);

    if (parts[1]) {
      const firstParts = parts[1].split(/\s+/);
      firstName = capitalizeName(firstParts[0]);

      if (firstParts.length > 1) {
        middleName = firstParts.slice(1).map(capitalizeName).join(" ");
      }
    }
  }
  // Format 2: "First Middle Last" (natural format)
  else {
    const parts = name.split(/\s+/).filter((s) => s);

    if (parts.length === 1) {
      // Single name - treat as last name
      lastName = capitalizeName(parts[0]);
      firstName = "";
    } else if (parts.length === 2) {
      // "First Last"
      firstName = capitalizeName(parts[0]);
      lastName = capitalizeName(parts[1]);
    } else {
      // "First Middle(s) Last"
      firstName = capitalizeName(parts[0]);
      lastName = capitalizeName(parts[parts.length - 1]);
      middleName = parts.slice(1, -1).map(capitalizeName).join(" ");
    }
  }

  // Ensure we have at least a last name or first name
  if (!lastName && !firstName) {
    lastName = "Unknown";
  } else if (!lastName) {
    lastName = firstName;
    firstName = "";
  }

  // Ensure firstName is never empty (required by schema)
  if (!firstName) {
    firstName = lastName;
  }

  return {
    firstName,
    lastName,
    middleName: middleName || undefined,
    orcid,
  };
}

/**
 * Parse multiple authors from a string
 * Handles "and" separator and various formats
 */
export function parseAuthorList(input: string): ParsedAuthor[] {
  if (!input || !input.trim()) return [];

  // Split by "and" (case-insensitive, with word boundaries)
  const authorStrings = input.split(/\s+and\s+/i);

  return authorStrings
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(parseAuthorName);
}

/**
 * Format a parsed author back to display string
 */
export function formatAuthorName(
  author: ParsedAuthor,
  format: "full" | "citation" = "full"
): string {
  if (format === "citation") {
    // Citation format: "Last, F."
    const firstInitial = author.firstName.charAt(0);
    return `${author.lastName}${firstInitial ? `, ${firstInitial}.` : ""}`;
  }

  // Full format: "First Middle Last"
  const parts = [author.firstName];
  if (author.middleName) {
    parts.push(author.middleName);
  }
  parts.push(author.lastName);

  return parts.filter(Boolean).join(" ");
}

/**
 * Format author list for display
 */
export function formatAuthorList(
  authors: ParsedAuthor[],
  options: {
    format?: "full" | "citation";
    maxDisplay?: number;
    separator?: string;
  } = {}
): string {
  const { format = "full", maxDisplay = Infinity, separator = ", " } = options;

  if (authors.length === 0) return "";

  const displayAuthors = authors.slice(0, maxDisplay);
  const formatted = displayAuthors.map((a) => formatAuthorName(a, format));

  let result = formatted.join(separator);

  if (authors.length > maxDisplay) {
    result += ` et al.`;
  }

  return result;
}
