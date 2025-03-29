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
    type_metadata: TextbookMetadata | PaperMetadata | ScriptMetadata | ThesisMetadata;
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
    Textbook: { dataKey: "textbooks", defaultTitle: "Untitled Textbook" },
    Paper: { dataKey: "papers", defaultTitle: "Untitled Paper" },
    Script: { dataKey: "scripts", defaultTitle: "Untitled Script" },
    Thesis: { dataKey: "theses", defaultTitle: "Untitled Thesis" },
    Manual: { dataKey: "manuals", defaultTitle: "Untitled Manual" },
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
