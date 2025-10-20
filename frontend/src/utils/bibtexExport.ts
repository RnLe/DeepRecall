/**
 * BibTeX Export Utilities
 * Convert Work entities to BibTeX format
 */

import type { WorkExtended } from "@/src/schema/library";
import type { Author } from "@/src/schema/library";

/**
 * Map preset names to BibTeX entry types
 */
const PRESET_TO_BIBTEX_TYPE: Record<string, string> = {
  Paper: "article",
  Textbook: "book",
  Book: "book",
  Thesis: "phdthesis",
  "Thesis (Master's)": "mastersthesis",
  "Thesis (PhD)": "phdthesis",
  Unpublished: "unpublished",
  Report: "techreport",
  Script: "manual",
  Slides: "misc",
  Proceedings: "proceedings",
  Booklet: "booklet",
  "Other/Misc": "misc",
};

/**
 * Generate a BibTeX citation key from work metadata
 */
function generateCiteKey(work: WorkExtended, authors?: Author[]): string {
  // Format: FirstAuthorLastName + Year + FirstWordOfTitle
  let key = "";

  // Add first author's last name
  if (authors && authors.length > 0) {
    const firstAuthor = authors[0];
    const lastName = firstAuthor.lastName || firstAuthor.firstName || "Unknown";
    key += lastName.replace(/[^a-zA-Z]/g, "");
  } else if (work.authors && work.authors.length > 0) {
    // Fallback to legacy authors
    const firstName = work.authors[0].name.split(" ").pop() || "Unknown";
    key += firstName.replace(/[^a-zA-Z]/g, "");
  } else {
    key += "Unknown";
  }

  // Add year
  if (work.year) {
    key += work.year;
  }

  // Add first significant word from title (skip articles)
  const skipWords = ["a", "an", "the", "on", "in", "of", "for"];
  const words = work.title
    .split(/\s+/)
    .filter((w) => w.length > 0 && !skipWords.includes(w.toLowerCase()));
  if (words.length > 0) {
    const firstWord = words[0].replace(/[^a-zA-Z]/g, "");
    key += firstWord;
  }

  return key;
}

/**
 * Format author list for BibTeX (Last, First and Last2, First2 and ...)
 */
function formatAuthorsForBibtex(authors: Author[]): string {
  return authors
    .map((author) => {
      if (author.lastName) {
        // If we have structured data
        const parts = [author.lastName];
        if (author.firstName) {
          parts.push(author.firstName);
          if (author.middleName) {
            parts.push(author.middleName);
          }
        }
        return `${author.lastName}, ${[author.firstName, author.middleName].filter(Boolean).join(" ")}`;
      } else {
        // If we only have first name or combined name
        return author.firstName || "Unknown";
      }
    })
    .join(" and ");
}

/**
 * Escape special BibTeX characters
 */
function escapeBibtex(str: string): string {
  return str
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/#/g, "\\#")
    .replace(/\$/g, "\\$")
    .replace(/%/g, "\\%")
    .replace(/&/g, "\\&")
    .replace(/_/g, "\\_")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}");
}

/**
 * Format a BibTeX field
 */
function formatField(key: string, value: string | number | undefined): string {
  if (!value) return "";
  const strValue = String(value);
  if (!strValue.trim()) return "";

  // Numbers don't need braces
  if (typeof value === "number" || /^\d+$/.test(strValue)) {
    return `  ${key.padEnd(12)} = {${strValue}},\n`;
  }

  return `  ${key.padEnd(12)} = {${escapeBibtex(strValue)}},\n`;
}

/**
 * Convert Work to BibTeX format
 */
export function workToBibtex(
  work: WorkExtended,
  presetName?: string,
  authors?: Author[]
): string {
  // Determine entry type from preset
  const entryType = (presetName && PRESET_TO_BIBTEX_TYPE[presetName]) || "misc";

  // Generate cite key
  const citeKey = generateCiteKey(work, authors);

  // Start building BibTeX entry
  let bibtex = `@${entryType}{${citeKey},\n`;

  // Required fields for all types
  bibtex += formatField("title", work.title);

  // Authors (if available)
  if (authors && authors.length > 0) {
    bibtex += formatField("author", formatAuthorsForBibtex(authors));
  } else if (work.authors && work.authors.length > 0) {
    // Fallback to legacy authors
    bibtex += formatField(
      "author",
      work.authors.map((a) => a.name).join(" and ")
    );
  }

  // Entry-type specific fields
  switch (entryType) {
    case "article":
      bibtex += formatField("journal", work.metadata?.journal as string);
      bibtex += formatField("year", work.year);
      bibtex += formatField("volume", work.metadata?.volume as string);
      bibtex += formatField("number", work.metadata?.number as string);
      bibtex += formatField("pages", work.metadata?.pages as string);
      bibtex += formatField("month", work.metadata?.month as string);
      bibtex += formatField("doi", work.doi);
      break;

    case "book":
      bibtex += formatField("publisher", work.publisher);
      bibtex += formatField("year", work.year);
      bibtex += formatField("volume", work.metadata?.volume as string);
      bibtex += formatField("series", work.metadata?.series as string);
      bibtex += formatField("address", work.metadata?.address as string);
      bibtex += formatField("edition", work.metadata?.edition as string);
      bibtex += formatField("isbn", work.isbn);
      break;

    case "inproceedings":
    case "conference":
      bibtex += formatField("booktitle", work.metadata?.booktitle as string);
      bibtex += formatField("year", work.year);
      bibtex += formatField("pages", work.metadata?.pages as string);
      bibtex += formatField("publisher", work.publisher);
      bibtex += formatField(
        "organization",
        work.metadata?.organization as string
      );
      bibtex += formatField("address", work.metadata?.address as string);
      bibtex += formatField("doi", work.doi);
      break;

    case "phdthesis":
    case "mastersthesis":
      bibtex += formatField("school", work.metadata?.school as string);
      bibtex += formatField("year", work.year);
      bibtex += formatField("type", work.metadata?.type as string);
      bibtex += formatField("address", work.metadata?.address as string);
      break;

    case "techreport":
      bibtex += formatField(
        "institution",
        work.metadata?.institution as string
      );
      bibtex += formatField("year", work.year);
      bibtex += formatField("type", work.metadata?.type as string);
      bibtex += formatField("number", work.metadata?.number as string);
      bibtex += formatField("address", work.metadata?.address as string);
      break;

    case "unpublished":
      bibtex += formatField("year", work.year);
      bibtex += formatField("note", work.metadata?.note as string);
      break;

    case "proceedings":
      bibtex += formatField("year", work.year);
      bibtex += formatField("publisher", work.publisher);
      bibtex += formatField("volume", work.metadata?.volume as string);
      bibtex += formatField("series", work.metadata?.series as string);
      bibtex += formatField(
        "organization",
        work.metadata?.organization as string
      );
      bibtex += formatField("address", work.metadata?.address as string);
      break;

    case "booklet":
      bibtex += formatField(
        "howpublished",
        work.metadata?.howpublished as string
      );
      bibtex += formatField("year", work.year);
      bibtex += formatField("address", work.metadata?.address as string);
      break;

    case "manual":
      bibtex += formatField(
        "organization",
        work.metadata?.organization as string
      );
      bibtex += formatField("year", work.year);
      bibtex += formatField("address", work.metadata?.address as string);
      bibtex += formatField("edition", work.metadata?.edition as string);
      break;

    case "misc":
    default:
      bibtex += formatField("year", work.year);
      bibtex += formatField(
        "howpublished",
        work.metadata?.howpublished as string
      );
      bibtex += formatField("url", work.metadata?.url as string);
      bibtex += formatField("note", work.metadata?.note as string);
      break;
  }

  // Optional common fields
  if (work.subtitle) {
    bibtex += formatField("subtitle", work.subtitle);
  }

  // arXiv ID
  if (work.arxivId) {
    bibtex += formatField("arxiv", work.arxivId);
  }

  // Keywords/topics
  if (work.topics && work.topics.length > 0) {
    bibtex += formatField("keywords", work.topics.join(", "));
  }

  // Remove trailing comma and close entry
  bibtex = bibtex.trimEnd();
  if (bibtex.endsWith(",")) {
    bibtex = bibtex.slice(0, -1);
  }
  bibtex += "\n}\n";

  return bibtex;
}

/**
 * Download BibTeX as .bib file
 */
export function downloadBibtex(bibtex: string, filename: string) {
  const blob = new Blob([bibtex], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".bib") ? filename : `${filename}.bib`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    // Fallback method
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textArea);
      return success;
    } catch (fallbackError) {
      console.error("Fallback copy failed:", fallbackError);
      return false;
    }
  }
}
