/**
 * BibTeX parser and utilities
 * Handles parsing BibTeX entries and mapping to Work presets
 */

/**
 * BibTeX entry type
 */
export interface BibtexEntry {
  type: string; // article, book, inproceedings, etc.
  key: string; // citation key
  fields: Record<string, string>;
}

/**
 * Parse result with validation
 */
export interface ParseResult {
  success: boolean;
  entries: BibtexEntry[];
  errors: string[];
}

/**
 * Map BibTeX entry types to preset names
 */
export const BIBTEX_TO_PRESET_MAP: Record<string, string> = {
  // Paper preset covers these
  article: "Paper",
  inproceedings: "Paper",
  conference: "Paper",
  incollection: "Paper",

  // Textbook (specialized book)
  // textbook is not a standard BibTeX type, but we can use it if manually specified

  // Book preset
  book: "Book",
  inbook: "Book",

  // Thesis preset
  phdthesis: "Thesis",
  mastersthesis: "Thesis",

  // Report preset
  techreport: "Report",
  manual: "Report",

  // Proceedings preset
  proceedings: "Proceedings",

  // Unpublished preset
  unpublished: "Unpublished",

  // Booklet preset
  booklet: "Booklet",

  // Misc preset
  misc: "Misc",
};

/**
 * Standard BibTeX entry types
 */
export const STANDARD_BIBTEX_TYPES = [
  "article",
  "book",
  "booklet",
  "conference",
  "inbook",
  "incollection",
  "inproceedings",
  "manual",
  "mastersthesis",
  "misc",
  "phdthesis",
  "proceedings",
  "techreport",
  "unpublished",
];

/**
 * Parse BibTeX string into entries
 */
export function parseBibtex(bibtexString: string): ParseResult {
  const entries: BibtexEntry[] = [];
  const errors: string[] = [];

  // Remove comments (lines starting with %)
  const cleanedString = bibtexString
    .split("\n")
    .filter((line) => !line.trim().startsWith("%"))
    .join("\n");

  // Match @type{key, ...} pattern
  const entryRegex = /@(\w+)\s*\{\s*([^,]+)\s*,([^]*?)^\}/gim;

  let match;
  let entryCount = 0;

  while ((match = entryRegex.exec(cleanedString)) !== null) {
    entryCount++;
    const [, type, key, fieldsString] = match;

    // Validate type
    const normalizedType = type.toLowerCase();
    if (!STANDARD_BIBTEX_TYPES.includes(normalizedType)) {
      errors.push(
        `Entry ${entryCount} (@${type}): Not a standard BibTeX entry type. Standard types are: ${STANDARD_BIBTEX_TYPES.join(", ")}`
      );
      continue;
    }

    // Parse fields
    const fields: Record<string, string> = {};
    const fieldRegex = /(\w+)\s*=\s*[{"']([^}"]*)["'}]/g;

    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(fieldsString)) !== null) {
      const [, fieldName, fieldValue] = fieldMatch;
      fields[fieldName.toLowerCase()] = fieldValue.trim();
    }

    // Also handle fields without quotes (for numbers)
    const fieldRegexNoQuotes = /(\w+)\s*=\s*([^,}\n]+?)(?=,|\s*}|\s*\n)/g;
    while ((fieldMatch = fieldRegexNoQuotes.exec(fieldsString)) !== null) {
      const [, fieldName, fieldValue] = fieldMatch;
      const normalizedFieldName = fieldName.toLowerCase();
      if (!fields[normalizedFieldName]) {
        fields[normalizedFieldName] = fieldValue.trim();
      }
    }

    entries.push({
      type: normalizedType,
      key: key.trim(),
      fields,
    });
  }

  // Validation
  if (entryCount === 0) {
    errors.push(
      "No valid BibTeX entries found. Entries should start with @type{key, ...}"
    );
  }

  return {
    success: entries.length > 0 && errors.length === 0,
    entries,
    errors,
  };
}

/**
 * Map BibTeX entry to Work form values
 */
export function bibtexToWorkFormValues(
  entry: BibtexEntry
): Record<string, unknown> {
  const { fields } = entry;
  const formValues: Record<string, unknown> = {};

  // Title (required for all)
  formValues.title = fields.title || "Untitled";

  // Subtitle
  if (fields.subtitle) {
    formValues.subtitle = fields.subtitle;
  }

  // Authors - store as unparsed string for smart parsing in form
  if (fields.author) {
    formValues.authors = fields.author;
  } else if (fields.editor) {
    // Use editor if no author
    formValues.authors = fields.editor;
  }

  // Year
  if (fields.year) {
    const year = parseInt(fields.year, 10);
    if (!isNaN(year)) {
      formValues.year = year;
    }
  }

  // Month
  if (fields.month) {
    formValues.month = fields.month.toLowerCase();
  }

  // Journal (for articles)
  if (fields.journal) {
    formValues.journal = fields.journal;
  }

  // Booktitle (for conference papers)
  if (fields.booktitle) {
    formValues.booktitle = fields.booktitle;
  }

  // Publisher
  if (fields.publisher) {
    formValues.publisher = fields.publisher;
  }

  // Volume
  if (fields.volume) {
    formValues.volume = fields.volume;
  }

  // Number/Issue
  if (fields.number) {
    formValues.number = fields.number;
  }

  // Pages
  if (fields.pages) {
    formValues.pages = fields.pages;
  }

  // Address
  if (fields.address) {
    formValues.address = fields.address;
  }

  // Edition
  if (fields.edition) {
    formValues.edition = fields.edition;
  }

  // Series
  if (fields.series) {
    formValues.series = fields.series;
  }

  // Editor (separate field for proceedings/books)
  if (fields.editor && entry.type !== "article") {
    formValues.editor = fields.editor;
  }

  // Organization
  if (fields.organization) {
    formValues.organization = fields.organization;
  }

  // DOI
  if (fields.doi) {
    formValues.doi = fields.doi;
  }

  // URL
  if (fields.url) {
    formValues.url = fields.url;
  }

  // ISBN
  if (fields.isbn) {
    formValues.isbn = fields.isbn;
  }

  // Abstract
  if (fields.abstract) {
    formValues.abstract = fields.abstract;
  }

  // Note
  if (fields.note) {
    formValues.note = fields.note;
  }

  // Thesis-specific fields
  if (entry.type === "phdthesis" || entry.type === "mastersthesis") {
    if (fields.school) {
      formValues.school = fields.school;
    }
    if (entry.type === "phdthesis") {
      formValues.thesisType = "phd";
    } else {
      formValues.thesisType = "masters";
    }
  }

  // Report-specific fields
  if (entry.type === "techreport" || entry.type === "manual") {
    if (fields.institution) {
      formValues.institution = fields.institution;
    }
    if (fields.type) {
      formValues.type = fields.type;
    }
  }

  // Unpublished-specific
  if (entry.type === "unpublished") {
    if (!fields.note) {
      formValues.note = "Unpublished work";
    }
  }

  // Booklet/Misc-specific
  if (entry.type === "booklet" || entry.type === "misc") {
    if (fields.howpublished) {
      formValues.howpublished = fields.howpublished;
    }
  }

  // Chapter (for inbook)
  if (fields.chapter) {
    formValues.chapter = fields.chapter;
  }

  return formValues;
}

/**
 * Get preset name for a BibTeX entry
 */
export function getPresetForBibtexEntry(entry: BibtexEntry): string {
  return BIBTEX_TO_PRESET_MAP[entry.type] || "Misc";
}

/**
 * Validate BibTeX string (quick check)
 */
export function validateBibtexString(bibtexString: string): {
  valid: boolean;
  message?: string;
} {
  const trimmed = bibtexString.trim();

  if (!trimmed) {
    return { valid: false, message: "BibTeX string is empty" };
  }

  if (!trimmed.startsWith("@")) {
    return {
      valid: false,
      message: 'BibTeX entries should start with "@" (e.g., @article{...})',
    };
  }

  // Check for basic structure
  const hasOpeningBrace = trimmed.includes("{");
  const hasClosingBrace = trimmed.includes("}");

  if (!hasOpeningBrace || !hasClosingBrace) {
    return {
      valid: false,
      message: "BibTeX entry is missing opening or closing braces",
    };
  }

  return { valid: true };
}
