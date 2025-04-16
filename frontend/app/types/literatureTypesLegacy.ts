// literatureTypes.ts

// When creating a new literature type, changes have to be made in multiple places.
// This is necessary because of the different styles and metadata associated with each type.
// This is a list of files and components, where literature types are defined and used.

export const LITERATURE_TYPES = [
    "Textbook",
    "Paper",
    "Script",
    "Thesis",
    "Manual",
  ] as const;
  
  export type LiteratureType = typeof LITERATURE_TYPES[number];
  export type LiteratureMetadata =
    | TextbookMetadata
    | PaperMetadata
    | ScriptMetadata
    | ThesisMetadata
    | ManualMetadata;
  export type LiteratureVersion =
    | TextbookVersion
    | PaperVersion
    | ScriptVersion
    | ThesisVersion
    | ManualVersion;
  
  // Strapi MediaFile. Stores any type of media (not changeable)
  export interface MediaFile {
    id: number;
    name: string;
    alternativeText?: string | null;
    caption?: string | null;
    width?: number | null;
    height?: number | null;
    formats?: any;
    hash: string;
    ext: string;
    mime: string;
    size: number;
    url: string;
    previewUrl?: string | null;
    provider: string;
    provider_metadata?: any;
    createdAt: string;
    updatedAt: string;
    publishedAt: string;
    documentId: string;
  }
  
  // Unified Literature table
  export interface Literature {
    documentId: string;
    title: string;
    type: LiteratureType;
    /**
     * A JSON object containing all type-specific metadata.
     * This must exist (even if empty) to simplify processing.
     */
    type_metadata: TextbookMetadata | PaperMetadata | ScriptMetadata | ThesisMetadata | ManualMetadata;
  }
  
  /**
   * BaseVersion contains the common fields for all literature versions.
   * Note the inclusion of file_url and thumbnail_url for accessing the media.
   */
  export interface BaseVersion {
    year: number;
    file_id: number;
    file_hash: string;
    file_url: string; // URL of the media file
    thumbnail_media_id?: number;
    thumbnail_url?: string; // URL of the thumbnail image
    page_count: number;
    file_size: number;
  }
  
  export interface TextbookMetadata {
    subtitle?: string;
    description?: string;
    isbn?: string;
    doi?: string;
    authors?: Author[];
    /**
     * Versions is an array of version metadata.
     * Each entry should correspond to a PDF file.
     */
    versions?: TextbookVersion[];
  }
  
  export interface TextbookVersion extends BaseVersion {
    edition_number: number;
  }
  
  export interface PaperMetadata {
    subtitle?: string;
    journal?: string;
    doi?: string;
    authors?: Author[];
    versions?: PaperVersion[];
  }
  
  export interface PaperVersion extends BaseVersion {
    version_number?: string;
    volume?: string;
    pages?: string;
  }
  
  export interface ScriptMetadata {
    subtitle?: string;
    authors?: Author[];
    versions?: ScriptVersion[];
  }
  
  export interface ScriptVersion extends BaseVersion {
    version?: string;
  }
  
  export interface ThesisMetadata {
    subtitle?: string;
    institution?: string;
    authors?: Author[];
    advisor?: string;
    versions?: ThesisVersion[];
  }
  
  export interface ThesisVersion extends BaseVersion {
    // No additional fields are needed for ThesisVersion.
  }

  export interface ManualMetadata {
    subtitle?: string;
    authors?: Author[];
    versions?: ManualVersion[];
  }

  export interface ManualVersion extends BaseVersion {
    // No additional fields are needed for Manual
  }
  
  export interface Author {
    id?: number;
    createdAt?: string;
    updatedAt?: string;
    first_name: string;
    last_name: string;
    orcid?: string;
  }

  export const LITERATURE_TYPE_MAP: Record<LiteratureType, { dataKey: string; defaultTitle: string }> = {
    Textbook: { dataKey: "Textbook", defaultTitle: "Untitled Textbook" },
    Paper: { dataKey: "Paper", defaultTitle: "Untitled Paper" },
    Script: { dataKey: "Script", defaultTitle: "Untitled Script" },
    Thesis: { dataKey: "Thesis", defaultTitle: "Untitled Thesis" },
    Manual: { dataKey: "Manual", defaultTitle: "Untitled Manual" },
  };  

// Strings for the plural of each literature type
export const LITERATURE_TYPE_STRING_PLURAL: Record<LiteratureType, string> = {
    Textbook: "Textbooks",
    Paper: "Papers",
    Script: "Scripts",
    Thesis: "Theses",
    Manual: "Manuals",
};

export interface LiteratureItem {
  documentId: string;
  title: string;
  subtitle?: string;
  type: LiteratureType;
  createdAt?: string;
  updatedAt?: string;
  metadata: any; // Unified metadata containing version info
  authors?: any[];
}

export const mapLiteratureItems = (data: any, selectedType: LiteratureType): LiteratureItem[] => {
    const config = LITERATURE_TYPE_MAP[selectedType];
    if (!config) return [];
    const items = Array.isArray(data[config.dataKey]) ? data[config.dataKey] : [];
    return items.map((item: any) => ({
        documentId: item.documentId,
        title: item.title || config.defaultTitle,
        subtitle: item.type_metadata?.subtitle,
        type: selectedType,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        metadata: item.type_metadata,
        authors: item.authors,
    }));
};

// This is the form field configuration for each literature type.
export interface LiteratureFormField {
  name: string; // key in the metadata object
  label: string;
  type: "text" | "textarea" | "number";
  placeholder?: string;
  required?: boolean;
}

export const LITERATURE_FORM_FIELDS: Record<LiteratureType, LiteratureFormField[]> = {
  Textbook: [
    // subtitle is common so we don’t include it here
    { name: "description", label: "Description (optional)", type: "textarea" },
    { name: "isbn", label: "ISBN (optional)", type: "text" },
    { name: "doi", label: "DOI (optional)", type: "text" },
  ],
  Paper: [
    { name: "journal", label: "Journal (optional)", type: "text" },
    { name: "doi", label: "DOI (optional)", type: "text" },
  ],
  Script: [
    // No extra fields beyond the common subtitle
  ],
  Thesis: [
    { name: "institution", label: "Institution", type: "text", required: true },
    { name: "advisor", label: "Advisor", type: "text", required: true },
  ],
  Manual: [
    // For example, no extra fields
  ],
};

// This is the form field configuration for each version of the literature type.
export interface VersionFormField {
  name: string; // key in the version object (e.g. "edition_number")
  label: string;
  type: "text" | "number";
  placeholder?: string;
  required?: boolean;
}

export const LITERATURE_VERSION_FORM_FIELDS: Record<LiteratureType, VersionFormField[]> = {
  Textbook: [
    { name: "edition_number", label: "Edition Number", type: "number", required: true },
    { name: "tasks_pdf", label: "Tasks PDF (optional)", type: "text" },
  ],
  Paper: [
    { name: "version_number", label: "Version Number (optional)", type: "text" },
    { name: "volume", label: "Volume (optional)", type: "text" },
    { name: "pages", label: "Pages (optional)", type: "text" },
  ],
  Script: [
    { name: "version", label: "Version (optional)", type: "text" },
  ],
  Thesis: [
    // No extra fields
  ],
  Manual: [
    // No extra fields (or add as needed)
  ],
};